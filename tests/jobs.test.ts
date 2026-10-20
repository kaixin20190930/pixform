import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { poll, type Job } from "../lib/jobs.ts";
import { sweep } from "../lib/cleanup.ts";
import type { Env } from "../lib/cloudflare.ts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0002_daily_metrics.sql", import.meta.url), "utf8"));
  const objects = new Map<string, unknown>();
  const env = {
    DB: { prepare(sql: string) {
      const statement = db.prepare(sql);
      return { bind(...args: (string | number | null)[]) {
        return { first: async () => statement.get(...args) || null, run: async () => statement.run(...args), all: async () => ({ results: statement.all(...args) }) };
      } };
    } },
    MEDIA: { delete: async (keys: string[]) => { keys.forEach(k => objects.delete(k)); }, put: async (key: string, value: unknown) => { objects.set(key, value); } },
    JOB_SIGNING_SECRET: "test-only-long-enough-signing-secret",
    REPLICATE_API_TOKEN: "test-token",
    REPLICATE_SDXL_VERSION: "test-version",
  } as unknown as Env;
  const job: Job = { id: crypto.randomUUID(), prediction_id: "original", status: "starting", style: "watercolor", attempts: 1, created_at: Date.now(), expires_at: Date.now() + 7200000, output_key: null, output_type: null, error: null };
  db.prepare("INSERT INTO jobs (id,prediction_id,status,style,attempts,created_at,expires_at) VALUES (?,?,?,?,?,?,?)").run(job.id, job.prediction_id, job.status, job.style, 1, job.created_at, job.expires_at);
  return { db, env, job, objects };
}
test("rolling quota SQL admits ten attempts and rejects the eleventh", () => {
  const { db } = fixture();
  const source = readFileSync(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
  const sql = source.match(/prepare\("(INSERT INTO usage[^"]+)"\)/)![1];
  const statement = db.prepare(sql);
  const now = Date.now();
  for (let n = 0; n < 10; n++) assert.ok(statement.get(`id-${n}`, "ip-a", now, "ip-a", now - 3600000));
  assert.equal(statement.get("eleven", "ip-a", now, "ip-a", now - 3600000), undefined);
  assert.ok(statement.get("other", "ip-b", now, "ip-b", now - 3600000));
  assert.ok(statement.get("expired", "ip-a", now + 3600001, "ip-a", now + 1));
  db.close();
});
test("concurrent polls retry a transient failure once, without double creation", async () => {
  const { db, env, job } = fixture();
  const original = globalThis.fetch; let posts = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "POST") { posts++; return Response.json({ id: "retry", status: "starting" }); }
    return Response.json({ id: "original", status: "failed", error: "CUDA out of memory" });
  };
  try {
    await Promise.all([poll(env, { ...job }, "https://pixform.ai"), poll(env, { ...job }, "https://pixform.ai")]);
    assert.equal(posts, 1);
    const row = db.prepare("SELECT * FROM jobs WHERE id=?").get(job.id);
    assert.equal(row?.attempts, 2); assert.equal(row?.prediction_id, "retry");
  } finally { globalThis.fetch = original; db.close(); }
});
test("content safety failure is terminal and never retried", async () => {
  const { db, env, job } = fixture();
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ id: "original", status: "failed", error: "NSFW content" }); };
  try { await poll(env, job, "https://pixform.ai"); assert.equal(calls, 1); assert.equal(job.status, "failed"); }
  finally { globalThis.fetch = original; db.close(); }
});
test("cleanup deletes both private objects before retiring an expired record", async () => {
  const { db, env, job, objects } = fixture();
  db.prepare("UPDATE jobs SET expires_at=? WHERE id=?").run(Date.now() - 1, job.id);
  objects.set(`input/${job.id}`, "input"); objects.set(`output/${job.id}`, "output");
  await sweep(env);
  assert.equal(objects.size, 0);
  assert.equal(db.prepare("SELECT id FROM jobs WHERE id=?").get(job.id), undefined);
  db.close();
});
test("aggregate terminal metrics are counted once and survive job deletion", () => {
  const { db, job } = fixture();
  db.prepare("UPDATE jobs SET status='succeeded', completed_at=? WHERE id=?").run(job.created_at + 12000, job.id);
  db.prepare("UPDATE jobs SET status='succeeded' WHERE id=?").run(job.id);
  db.prepare("DELETE FROM jobs WHERE id=?").run(job.id);
  const metrics = db.prepare("SELECT attempts,succeeded,failed,total_wait_ms FROM daily_metrics").get();
  assert.equal(metrics?.attempts, 1); assert.equal(metrics?.succeeded, 1);
  assert.equal(metrics?.failed, 0); assert.equal(metrics?.total_wait_ms, 12000);
  db.close();
});
