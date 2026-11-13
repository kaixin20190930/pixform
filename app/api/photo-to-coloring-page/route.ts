import { environment } from "@/lib/cloudflare";
import { coloringEnabled, startColoring } from "@/lib/coloring-jobs";
import { currentSession, sameOrigin } from "@/lib/session";
import { json } from "@/lib/jobs";

export async function POST(request: Request) {
  try {
    const env = await environment();
    if (!coloringEnabled(env)) return json({error:"Coloring pages are available only in the isolated preview."},503);
    if (!sameOrigin(request) || new URL(request.url).origin !== env.APP_ORIGIN) return json({error:"Use the Pixform preview website."},403);
    const session = await currentSession(env,request.headers);
    if (!session) return json({error:"Sign in to generate a coloring page.",code:"AUTH_REQUIRED"},401);
    return await startColoring(env,request,session.user.id);
  } catch { return json({error:"The service is temporarily unavailable. Check your request before trying again."},503); }
}
