import { environment } from "@/lib/cloudflare";
import { getJob, json } from "@/lib/jobs";
export async function GET(request: Request) {
  try {
    const env = await environment();
    const job = await getJob(env, request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    if (!job?.output_key || job.status !== "succeeded") return json({ error: "Result unavailable or expired." }, 404);
    const object = await env.MEDIA.get(job.output_key);
    if (!object) return json({ error: "Result unavailable or expired." }, 404);
    const extension = job.output_type === "image/webp" ? "webp" : job.output_type === "image/jpeg" ? "jpg" : "png";
    return new Response(object.body as unknown as ReadableStream, { headers: { "Content-Type": job.output_type || "image/png", "Content-Disposition": `attachment; filename="pixform-${job.style}.${extension}"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch { return json({ error: "Download unavailable." }, 503); }
}
