import { environment, ready } from "@/lib/cloudflare";
import { createPrediction, finish, json, type Job } from "@/lib/jobs";
import { digest, imageType, MAX_BODY_BYTES, MAX_IMAGE_BYTES, sign } from "@/lib/security";
import { styles } from "@/lib/content";

export async function POST(request: Request) {
  try {
    const env = await environment();
    if (!ready(env)) return json({ error: "Image generation is being prepared. Please check back soon." }, 503);
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return json({ error: "Please generate from the Pixform website." }, 403);
    // CF-Connecting-IP is trusted only in the Cloudflare deployed runtime.
    const ip = request.headers.get("cf-connecting-ip");
    if (!ip) return json({ error: "The connection could not be verified." }, 403);
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return json({ error: "Choose an image under 10 MB." }, 413);
    const reader = request.body?.getReader(); if (!reader) return json({ error: "Choose an image." }, 400);
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_BODY_BYTES) { await reader.cancel(); return json({ error: "Choose an image under 10 MB." }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("image"); const style = String(form.get("style"));
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES || !styles.some(s => s.id === style)) return json({ error: "Choose a valid image and one of the available styles." }, 400);
    const data = new Uint8Array(await file.arrayBuffer()); const type = imageType(data);
    if (!type || file.type !== type) return json({ error: "Choose a valid JPG, PNG or WEBP image." }, 400);
    const now = Date.now(); const id = crypto.randomUUID();
    const ipHash = await digest(env.JOB_SIGNING_SECRET!, `ip:${ip}`);
    // D1 serializes the single SQL statement, including the rolling-window check.
    const allowed = await env.DB.prepare("INSERT INTO usage (id, ip_hash, created_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM usage WHERE ip_hash = ? AND created_at > ?) < 10 RETURNING id").bind(id, ipHash, now, ipHash, now - 3600000).first();
    if (!allowed) return json({ error: "You've reached 10 attempts in an hour. Please try again later." }, 429);
    const job: Job = { id, prediction_id: null, status: "starting", style, attempts: 1, created_at: now, expires_at: now + 7200000, output_key: null, output_type: null, error: null };
    await env.DB.prepare("INSERT INTO jobs (id, status, style, attempts, created_at, expires_at) VALUES (?, ?, ?, 1, ?, ?)").bind(id, job.status, style, now, job.expires_at).run();
    await env.MEDIA.put(`input/${id}`, data, { httpMetadata: { contentType: type } });
    try {
      const prediction = await createPrediction(env, job, origin);
      await env.DB.prepare("UPDATE jobs SET prediction_id = ? WHERE id = ?").bind(prediction.id, id).run();
    } catch (error) {
      // Unknown POST outcomes must not be automatically repeated (could double-charge).
      const reason = error instanceof Error && /^Provider HTTP \d{3}$/.test(error.message)
        ? error.message : error instanceof Error ? error.name : "UnknownError";
      await finish(env, job, "failed", `Unable to confirm generation (${reason})`);
      return json({ error: "We couldn't confirm that generation started. Please try again later." }, 502);
    }
    return json({ token: await sign(env.JOB_SIGNING_SECRET!, id, "job", job.expires_at), status: "starting" }, 202);
  } catch { return json({ error: "The image service is temporarily unavailable. Your photo is still selected." }, 503); }
}
