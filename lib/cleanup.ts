import type { Env } from "./cloudflare";
import { poll, type Job } from "./jobs.ts";

export async function sweep(env: Env) {
  // Finish jobs even when the user closes the tab. Tokens never extend retention.
  const active = await env.DB.prepare("SELECT * FROM jobs WHERE status IN ('starting','processing') AND prediction_id IS NOT NULL AND expires_at > ? ORDER BY created_at LIMIT 20").bind(Date.now()).all<Job>();
  for (const job of active.results) {
    try { await poll(env, job, "https://pixform.ai"); } catch { /* Retry read-only reconciliation next minute. */ }
  }
  const expired = await env.DB.prepare("SELECT id FROM jobs WHERE expires_at <= ? LIMIT 100").bind(Date.now()).all<{ id: string }>();
  for (const { id } of expired.results) {
    // Never remove the record until both objects are deleted, so cleanup can retry.
    await env.MEDIA.delete([`input/${id}`, `output/${id}`]);
    await env.DB.prepare("DELETE FROM jobs WHERE id = ? AND expires_at <= ?").bind(id, Date.now()).run();
  }
  await env.DB.prepare("DELETE FROM usage WHERE created_at <= ?").bind(Date.now() - 3600000).run();
}
