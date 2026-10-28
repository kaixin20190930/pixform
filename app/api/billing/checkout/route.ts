import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession, sameOrigin } from "@/lib/session";
import { ensureBillingAccount } from "@/lib/billing/credits";
import { isOfferKey, OFFERS } from "@/lib/billing/catalog";
import { offerPrice, stripeClient } from "@/lib/billing/stripe";
import { json } from "@/lib/jobs";

export async function POST(request: Request) {
  const env = await environment();
  if (!billingReady(env)) return json({ error: "Billing is not enabled." }, 503);
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const session = await currentSession(env, request.headers);
  if (!session) return json({ error: "Sign in required." }, 401);
  const input = await request.json().catch(() => ({})) as { offerKey?: string };
  if (!input.offerKey || !isOfferKey(input.offerKey)) return json({ error: "Unknown offer." }, 400);
  await ensureBillingAccount(env, session.user.id);
  const stripe = stripeClient(env); const offer = OFFERS[input.offerKey];
  let account = await env.DB.prepare("SELECT stripe_customer_id,stripe_subscription_id,subscription_status FROM billing_accounts WHERE user_id=?").bind(session.user.id).first<{stripe_customer_id:string|null;stripe_subscription_id:string|null;subscription_status:string|null}>();
  if (offer.kind === "subscription" && account?.stripe_subscription_id && account.subscription_status && !["canceled","incomplete_expired"].includes(account.subscription_status)) {
    return json({ error: "You already have a subscription. Manage it from your account." }, 409);
  }
  if(offer.kind === "subscription"){
    const pending=await env.DB.prepare("SELECT id FROM billing_orders WHERE user_id=? AND offer_key IN ('pro_monthly_v1','pro_yearly_v1') AND status IN ('created','checkout_open') AND created_at>? LIMIT 1").bind(session.user.id,Date.now()-3600000).first();
    if(pending)return json({error:"A subscription checkout is already open. Complete it or try again in an hour."},409);
  }
  let customerId = account?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: session.user.email, name: session.user.name, metadata: { pixformUserId: session.user.id } }, { idempotencyKey: `customer:${session.user.id}` });
    customerId = customer.id;
    await env.DB.prepare("UPDATE billing_accounts SET stripe_customer_id=?,updated_at=? WHERE user_id=? AND stripe_customer_id IS NULL").bind(customerId,Date.now(),session.user.id).run();
  }
  const price = await offerPrice(stripe, input.offerKey); const orderId = crypto.randomUUID(); const now = Date.now();
  await env.DB.prepare("INSERT INTO billing_orders (id,user_id,offer_key,amount,currency,credits,status,created_at,updated_at) VALUES (?,?,?,?,?,?, 'created',?,?)")
    .bind(orderId,session.user.id,input.offerKey,offer.amount,offer.currency,offer.credits,now,now).run();
  const checkout = await stripe.checkout.sessions.create({
    mode: offer.kind === "subscription" ? "subscription" : "payment",
    customer: customerId, line_items: [{ price: price.id, quantity: 1 }],
    automatic_tax: { enabled: true }, customer_update: { address: "auto", name: "auto" },
    allow_promotion_codes: true,
    success_url: `https://pixform.ai/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: "https://pixform.ai/pricing?checkout=cancelled",
    metadata: { pixformOrderId: orderId, pixformUserId: session.user.id, offerKey: input.offerKey },
    ...(offer.kind === "subscription" ? { subscription_data: { metadata: { pixformUserId: session.user.id, offerKey: input.offerKey } } } : {}),
  }, { idempotencyKey: `checkout:${orderId}` });
  await env.DB.prepare("UPDATE billing_orders SET stripe_checkout_session_id=?,status='checkout_open',updated_at=? WHERE id=?").bind(checkout.id,Date.now(),orderId).run();
  return json({ url: checkout.url });
}
