import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession, sameOrigin } from "@/lib/session";
import { stripeClient } from "@/lib/billing/stripe";
import { json } from "@/lib/jobs";

export async function POST(request: Request) {
  const env = await environment();
  if (!billingReady(env)) return json({ error: "Billing is not enabled." }, 503);
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const session = await currentSession(env, request.headers);
  if (!session) return json({ error: "Sign in required." }, 401);
  const row = await env.DB.prepare("SELECT stripe_customer_id FROM billing_accounts WHERE user_id=?").bind(session.user.id).first<{stripe_customer_id:string|null}>();
  if (!row?.stripe_customer_id) return json({ error: "No billing account found." }, 404);
  const portal = await stripeClient(env).billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: "https://pixform.ai/account" });
  return json({ url: portal.url });
}
