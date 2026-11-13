import type { Env } from "./cloudflare";
import { allowedOutput, retryableError, sign, verify } from "./security.ts";
import { styles } from "./content.ts";
import { settleCredits } from "./billing/credits.ts";

export type Job = { id: string; prediction_id: string | null; status: string; style: string; attempts: number; created_at: number; expires_at: number; output_key: string | null; output_type: string | null; error: string | null; user_id?: string | null; tool?: string | null; credits_reserved?: number };
type Prediction = { id: string; status: string; output?: unknown; error?: unknown };
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
export async function provider(env: Env, path: string, init?: RequestInit): Promise<Prediction> {
  const res = await fetch(`https://api.replicate.com/v1/${path}`, {
    ...init, headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "manual",
  });
  if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
  return res.json();
}
export async function createPrediction(env: Env, job: Job, origin: string, faceDeadline: "5m" | "15m" = "5m") {
  if (job.style === "face-crop") {
    const input = await sign(env.JOB_SIGNING_SECRET!, job.id, "input", job.expires_at);
    const face = await sign(env.JOB_SIGNING_SECRET!, job.id, "face", job.expires_at);
    return provider(env, "predictions", { method: "POST", headers: { "Cancel-After": faceDeadline }, body: JSON.stringify({
      version: env.REPLICATE_MULTI_FACE_SWAP_VERSION,
      input: { destination_image: `${origin}/api/media/${input}`, source_face_image: `${origin}/api/media/${face}`, source_face_index: 0, destination_face_index: 0 },
    }) });
  }
  if (job.style === "face-swap") {
    const input = await sign(env.JOB_SIGNING_SECRET!, job.id, "input", job.expires_at);
    const face = await sign(env.JOB_SIGNING_SECRET!, job.id, "face", job.expires_at);
    return provider(env, "predictions", { method: "POST", body: JSON.stringify({
      version: env.REPLICATE_FACE_SWAP_VERSION,
      input: { input_image: `${origin}/api/media/${input}`, swap_image: `${origin}/api/media/${face}` },
    }) });
  }
  const style = styles.find(s => s.id === job.style)!;
  const mediaToken = await sign(env.JOB_SIGNING_SECRET!, job.id, "input", job.expires_at);
  return provider(env, "predictions", { method: "POST", body: JSON.stringify({
    version: env.REPLICATE_SDXL_VERSION,
    input: { image: `${origin}/api/media/${mediaToken}`, prompt: `Reinterpret the original subject and composition as ${style.prompt}`, negative_prompt: "nudity, explicit content, watermark, text", prompt_strength: 0.65, num_outputs: 1, num_inference_steps: 25, width: 768, height: 768, disable_safety_checker: false },
  }) });
}
export async function getJob(env: Env, token: string, scope = "job") {
  const claims = await verify(env.JOB_SIGNING_SECRET || "", token, scope);
  if (!claims) return null;
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND expires_at > ?").bind(claims.id, Date.now()).first<Job>();
  return job;
}
export async function finish(env: Env, job: Job, status: string, error: string | null = null) {
  await env.DB.prepare("UPDATE jobs SET status = ?, error = ?, completed_at = ?, expires_at = ? WHERE id = ?")
    .bind(status, error, Date.now(), Date.now() + 3600000, job.id).run();
  job.status = status; job.error = error;
  if (job.credits_reserved) await settleCredits(env, job.id, status === "succeeded");
}
export async function poll(env: Env, job: Job, origin: string) {
  if (job.tool === "photo-to-coloring-page") {
    const { pollColoring } = await import("./coloring-jobs.ts");
    return pollColoring(env, job);
  }
  if (!job.prediction_id || !["starting", "processing"].includes(job.status)) return;
  const prediction = await provider(env, `predictions/${encodeURIComponent(job.prediction_id)}`);
  if (prediction.status === "failed" && job.attempts < 2 && retryableError(prediction.error)) {
    // A conditional write prevents concurrent browser polls from creating duplicate retries.
    const lease = await env.DB.prepare("UPDATE jobs SET attempts = 2, status = 'retrying' WHERE id = ? AND attempts = 1 AND status IN ('starting','processing') RETURNING id").bind(job.id).first();
    if (!lease) return;
    try {
      const next = await createPrediction(env, job, origin);
      await env.DB.prepare("UPDATE jobs SET prediction_id = ?, status = 'starting' WHERE id = ?").bind(next.id, job.id).run();
      job.status = "starting";
    } catch {
      await finish(env, job, "failed", "The service couldn't confirm the retry. Please try again later.");
    }
    return;
  }
  if (["failed", "canceled", "aborted"].includes(prediction.status)) {
    await finish(env, job, "failed", "We couldn't transform this image. Try a different photo or style. Your original is still here.");
    return;
  }
  if (prediction.status === "succeeded") {
    const url = allowedOutput(Array.isArray(prediction.output) ? prediction.output[0] : prediction.output);
    if (!url) { await finish(env, job, "failed", "The model returned an unsupported result. Please try another photo."); return; }
    const lock = await env.DB.prepare("UPDATE jobs SET status = 'saving' WHERE id = ? AND status IN ('starting','processing') RETURNING id").bind(job.id).first();
    if (!lock) return;
    try {
      const output = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: "manual" });
      const contentType = output.headers.get("content-type")?.split(";")[0] || "";
      if (!output.ok || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) throw new Error("Invalid result");
      const size = Number(output.headers.get("content-length") || 0);
      if (size > 20 * 1024 * 1024) throw new Error("Large result");
      const reader = output.body?.getReader(); if (!reader) throw new Error("Missing body");
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > 20 * 1024 * 1024) { await reader.cancel(); throw new Error("Large result"); } chunks.push(value); }
      const buffer = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
      const key = `output/${job.id}`;
      await env.MEDIA.put(key, buffer, { httpMetadata: { contentType } });
      await env.DB.prepare("UPDATE jobs SET output_key = ?, output_type = ? WHERE id = ?").bind(key, contentType, job.id).run();
      await finish(env, job, "succeeded");
      job.output_key = key; job.output_type = contentType;
    } catch { await finish(env, job, "failed", "Your result couldn't be saved. Please try again."); }
    return;
  }
  job.status = prediction.status === "processing" ? "processing" : "starting";
  await env.DB.prepare("UPDATE jobs SET status = ? WHERE id = ? AND status IN ('starting','processing')").bind(job.status, job.id).run();
}
export async function representation(env: Env, job: Job) {
  return { status: ["retrying", "saving"].includes(job.status) ? "processing" : job.status,
    ...(job.status === "succeeded" ? { output: `/api/media/${await sign(env.JOB_SIGNING_SECRET!, job.id, "output", job.expires_at)}` } : {}),
    ...(job.error ? { error: job.error } : {}) };
}
