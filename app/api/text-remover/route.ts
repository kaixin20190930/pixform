import { environment } from "@/lib/cloudflare";
import { startTextRemover } from "@/lib/text-remover-jobs";
import { currentSession, sameOrigin } from "@/lib/session";
import { textRemoverEnabled } from "@/lib/text-remover-config";
import { json } from "@/lib/jobs";

export async function POST(request: Request) {
  try {
    const env = await environment();
    if (!textRemoverEnabled(env)) return json({error:"Text removal are temporarily unavailable."},503);
    if (!sameOrigin(request) || new URL(request.url).origin !== env.APP_ORIGIN) return json({error:"Use the Pixform website."},403);
    const session = await currentSession(env,request.headers);
    if (!session) return json({error:"Sign in to remove text.",code:"AUTH_REQUIRED"},401);
    return await startTextRemover(env,request,session.user.id);
  } catch { return json({error:"The service is temporarily unavailable. Check your request before trying again."},503); }
}
