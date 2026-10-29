import type Stripe from "stripe";
import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession, sameOrigin } from "@/lib/session";
import { ensureBillingAccount } from "@/lib/billing/credits";
import { isOfferKey, OFFERS } from "@/lib/billing/catalog";
import { pendingCheckoutAction, type PendingCheckout } from "@/lib/billing/checkout";
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
    const row=await env.DB.prepare("SELECT id,offer_key,stripe_checkout_session_id,created_at FROM billing_orders WHERE user_id=? AND offer_key IN ('pro_monthly_v1','pro_yearly_v1') AND status IN ('created','checkout_open') ORDER BY created_at DESC LIMIT 1")
      .bind(session.user.id).first<{id:string;offer_key:string;stripe_checkout_session_id:string|null;created_at:number}>();
    const pending:PendingCheckout|null=row?{id:row.id,offerKey:row.offer_key,sessionId:row.stripe_checkout_session_id,createdAt:row.created_at}:null;
    let existing:Stripe.Checkout.Session|null=null;
    if(pending?.sessionId){
      try{existing=await stripe.checkout.sessions.retrieve(pending.sessionId);}
      catch{return json({error:"We could not verify your previous checkout. Please try again shortly."},502);}
    }
    const action=pendingCheckoutAction(pending,existing,input.offerKey);
    if(action==="reuse"&&existing?.url)return json({url:existing.url});
    if(action==="wait")return json({error:"Your checkout is still being prepared. Please try again shortly."},409);
    if(action==="confirming")return json({error:"Your previous checkout is being confirmed. Refresh your account before starting another subscription."},409);
    if(action==="expire"&&pending){
      if(existing?.status==="open"){
        try{await stripe.checkout.sessions.expire(existing.id);}
        catch{return json({error:"We could not close your previous checkout. Please try again shortly."},502);}
      }
      await env.DB.prepare("UPDATE billing_orders SET status='expired',updated_at=? WHERE id=? AND status IN ('created','checkout_open')").bind(Date.now(),pending.id).run();
    }else if(action==="create"&&pending){
      await env.DB.prepare("UPDATE billing_orders SET status='expired',updated_at=? WHERE id=? AND status IN ('created','checkout_open')").bind(Date.now(),pending.id).run();
    }
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
