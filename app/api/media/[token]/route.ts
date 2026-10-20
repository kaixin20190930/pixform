import { environment } from "@/lib/cloudflare";
import { getJob, json } from "@/lib/jobs";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const env = await environment(); const { token } = await params;
    let job = await getJob(env, token, "output"); let key = job?.output_key;
    if (!job) { job = await getJob(env, token, "input"); key = job ? `input/${job.id}` : null; }
    if (!job || !key) return json({ error: "Image unavailable or expired." }, 404);
    const object = await env.MEDIA.get(key);
    if (!object) return json({ error: "Image unavailable or expired." }, 404);
    return new Response(object.body as unknown as ReadableStream, { headers: { "Content-Type": object.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch { return json({ error: "Image unavailable." }, 503); }
}
