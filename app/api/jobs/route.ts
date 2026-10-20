import { environment } from "@/lib/cloudflare";
import { getJob, json, poll, representation } from "@/lib/jobs";
export async function GET(request: Request) {
  try {
    const env = await environment();
    const job = await getJob(env, request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    if (!job) return json({ error: "This result is unavailable or expired." }, 404);
    await poll(env, job, new URL(request.url).origin);
    return json(await representation(env, job));
  } catch { return json({ error: "We couldn't check your result. Please try again later." }, 503); }
}
