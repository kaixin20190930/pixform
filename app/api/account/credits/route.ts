import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession } from "@/lib/session";
import { balance } from "@/lib/billing/credits";
import { json } from "@/lib/jobs";

export async function GET(request: Request) {
  const env = await environment();
  if (!billingReady(env)) return json({ error: "Billing is not enabled." }, 503);
  const session = await currentSession(env, request.headers);
  if (!session) return json({ error: "Sign in required." }, 401);
  const value = await balance(env, session.user.id);
  return json({ ...value, total: (value?.subscription_credits || 0) + (value?.permanent_credits || 0) });
}
