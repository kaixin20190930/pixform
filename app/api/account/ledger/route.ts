import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession } from "@/lib/session";
import { json } from "@/lib/jobs";

export async function GET(request: Request) {
  const env = await environment();
  if (!billingReady(env)) return json({ error: "Billing is not enabled." }, 503);
  const session = await currentSession(env, request.headers);
  if (!session) return json({ error: "Sign in required." }, 401);
  const rows = await env.DB.prepare("SELECT bucket,delta,reason,ref_id,balance_after,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(session.user.id).all();
  return json({ entries: rows.results });
}
