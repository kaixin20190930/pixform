import type Stripe from "stripe";
import type { Env } from "../cloudflare";
import { OFFERS, isOfferKey } from "./catalog";
import { expireSubscriptionCredits, freezeAccount, grantCredits } from "./credits";
import { offerPrice, stripeClient, stripeId } from "./stripe";

async function userForCustomer(env: Env, customerId: string | null) {
  if (!customerId) return null;
  return env.DB.prepare("SELECT user_id FROM billing_accounts WHERE stripe_customer_id=?").bind(customerId).first<{user_id:string}>();
}
function subscriptionId(invoice: Stripe.Invoice) {
  const value = (invoice as unknown as {subscription?:unknown;parent?:{subscription_details?:{subscription?:unknown}}}).subscription ??
    (invoice as unknown as {parent?:{subscription_details?:{subscription?:unknown}}}).parent?.subscription_details?.subscription;
  return stripeId(value);
}
function periodEnd(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as unknown as {current_period_end?:number};
  return item.current_period_end ? item.current_period_end * 1000 : null;
}

async function fulfillPack(env: Env, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const offerKey = session.metadata?.offerKey; const userId = session.metadata?.pixformUserId; const orderId = session.metadata?.pixformOrderId;
  if (!offerKey || !isOfferKey(offerKey) || OFFERS[offerKey].kind !== "pack" || !userId || !orderId) throw new Error("CHECKOUT_METADATA_INVALID");
  const stripe = stripeClient(env); const expected = await offerPrice(stripe, offerKey);
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lines.data.length !== 1 || stripeId(lines.data[0].price) !== expected.id || session.amount_subtotal !== OFFERS[offerKey].amount || session.currency !== OFFERS[offerKey].currency) throw new Error("CHECKOUT_TOTAL_INVALID");
  const paymentIntent = stripeId(session.payment_intent); if (!paymentIntent) throw new Error("PAYMENT_INTENT_MISSING");
  await grantCredits(env,{userId,bucket:"permanent",source:"credit_pack",credits:OFFERS[offerKey].credits,externalRef:`payment_intent:${paymentIntent}`});
  await env.DB.prepare("UPDATE billing_orders SET stripe_payment_intent_id=?,status='paid',paid_at=COALESCE(paid_at,?),refundable_until=COALESCE(refundable_until,?),updated_at=? WHERE id=? AND user_id=?")
    .bind(paymentIntent,Date.now(),Date.now()+7*86400000,Date.now(),orderId,userId).run();
}

async function fulfillInvoice(env: Env, invoice: Stripe.Invoice) {
  const subId = subscriptionId(invoice); if (!subId) return;
  const stripe = stripeClient(env); const subscription = await stripe.subscriptions.retrieve(subId);
  const offerKey = subscription.metadata.offerKey || subscription.items.data[0]?.price.lookup_key;
  if (!offerKey || !isOfferKey(offerKey) || OFFERS[offerKey].kind !== "subscription") throw new Error("SUBSCRIPTION_OFFER_INVALID");
  const expectedPrice=await offerPrice(stripe, offerKey);
  if(subscription.items.data.length!==1||subscription.items.data[0].price.id!==expectedPrice.id)throw new Error("SUBSCRIPTION_PRICE_INVALID");
  const customerId = stripeId(subscription.customer); const account = await userForCustomer(env,customerId);
  const userId = subscription.metadata.pixformUserId || account?.user_id; if (!userId) throw new Error("BILLING_ACCOUNT_MISSING");
  const end = periodEnd(subscription);
  await grantCredits(env,{userId,bucket:"subscription",source:"invoice",credits:OFFERS[offerKey].credits,externalRef:`invoice:${invoice.id}`,reset:true,expiresAt:end});
  await env.DB.prepare("UPDATE billing_accounts SET stripe_customer_id=COALESCE(stripe_customer_id,?),stripe_subscription_id=?,plan_key=?,subscription_status=?,current_period_end=?,cancel_at_period_end=?,updated_at=? WHERE user_id=?")
    .bind(customerId,subscription.id,offerKey,subscription.status,end,subscription.cancel_at_period_end?1:0,Date.now(),userId).run();
  const paymentIntent=stripeId((invoice as unknown as {payment_intent?:unknown;payments?:{data?:Array<{payment?:{payment_intent?:unknown}}>} }).payment_intent) || stripeId((invoice as unknown as {payments?:{data?:Array<{payment?:{payment_intent?:unknown}}>} }).payments?.data?.[0]?.payment?.payment_intent);
  const now=Date.now();
  const linked=await env.DB.prepare(`UPDATE billing_orders SET stripe_payment_intent_id=?,stripe_invoice_id=?,status='paid',paid_at=?,refundable_until=?,updated_at=?
    WHERE id=(SELECT id FROM billing_orders WHERE user_id=? AND offer_key=? AND status='checkout_open' ORDER BY created_at DESC LIMIT 1) RETURNING id`)
    .bind(paymentIntent,invoice.id,now,now+7*86400000,now,userId,offerKey).first();
  if(!linked)await env.DB.prepare(`INSERT OR IGNORE INTO billing_orders
    (id,user_id,offer_key,stripe_payment_intent_id,stripe_invoice_id,amount,currency,credits,status,paid_at,refundable_until,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?, 'paid',?,?,?,?)`).bind(`invoice:${invoice.id}`,userId,offerKey,paymentIntent,invoice.id,OFFERS[offerKey].amount,OFFERS[offerKey].currency,OFFERS[offerKey].credits,now,now+7*86400000,now,now).run();
}

async function handleRefund(env:Env,charge:Stripe.Charge){
  if(!charge.refunded)return;
  const paymentIntent=stripeId(charge.payment_intent);
  const invoiceId=stripeId((charge as unknown as {invoice?:unknown}).invoice);
  const order=await env.DB.prepare("SELECT id,user_id,stripe_invoice_id FROM billing_orders WHERE stripe_payment_intent_id=? OR stripe_invoice_id=? ORDER BY paid_at DESC LIMIT 1").bind(paymentIntent,invoiceId).first<{id:string;user_id:string;stripe_invoice_id:string|null}>();
  if(!order)return;
  const external=order.stripe_invoice_id?`invoice:${order.stripe_invoice_id}`:`payment_intent:${paymentIntent}`;
  const grant=await env.DB.prepare("SELECT id,bucket,credits FROM credit_grants WHERE external_ref=? AND revoked_at IS NULL").bind(external).first<{id:string;bucket:string;credits:number}>();
  if(grant){try{await env.DB.prepare("INSERT INTO credit_revocations(external_ref,grant_id,user_id,bucket,credits,reason,created_at) VALUES (?,?,?,?,?,'payment_refunded',?)").bind(`charge:${charge.id}`,grant.id,order.user_id,grant.bucket,grant.credits,Date.now()).run();}catch{await freezeAccount(env,order.user_id);}}
  await env.DB.prepare("UPDATE billing_orders SET stripe_charge_id=?,status='refunded',updated_at=? WHERE id=?").bind(charge.id,Date.now(),order.id).run();
}

async function syncSubscription(env: Env, subscription: Stripe.Subscription, deleted = false) {
  const account = await userForCustomer(env,stripeId(subscription.customer)); if (!account) throw new Error("BILLING_ACCOUNT_MISSING");
  const end = periodEnd(subscription);
  await env.DB.prepare("UPDATE billing_accounts SET stripe_subscription_id=?,plan_key=?,subscription_status=?,current_period_end=?,cancel_at_period_end=?,updated_at=? WHERE user_id=?")
    .bind(deleted?null:subscription.id,deleted?null:(subscription.metadata.offerKey||subscription.items.data[0]?.price.lookup_key),subscription.status,end,subscription.cancel_at_period_end?1:0,Date.now(),account.user_id).run();
  if (deleted) await expireSubscriptionCredits(env,account.user_id,`subscription_deleted:${subscription.id}`);
}

export async function processStripeEvent(env: Env, event: Stripe.Event) {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": case "checkout.session.async_payment_succeeded": await fulfillPack(env,object as Stripe.Checkout.Session); break;
    case "checkout.session.async_payment_failed": {
      const s=object as Stripe.Checkout.Session; if(s.metadata?.pixformOrderId) await env.DB.prepare("UPDATE billing_orders SET status='failed',updated_at=? WHERE id=?").bind(Date.now(),s.metadata.pixformOrderId).run(); break;
    }
    case "invoice.paid": await fulfillInvoice(env,object as Stripe.Invoice); break;
    case "invoice.payment_failed": {
      const i=object as Stripe.Invoice; const a=await userForCustomer(env,stripeId(i.customer)); if(a) await env.DB.prepare("UPDATE billing_accounts SET subscription_status='past_due',updated_at=? WHERE user_id=?").bind(Date.now(),a.user_id).run(); break;
    }
    case "customer.subscription.updated": await syncSubscription(env,object as Stripe.Subscription); break;
    case "customer.subscription.deleted": await syncSubscription(env,object as Stripe.Subscription,true); break;
    case "charge.refunded": await handleRefund(env,object as Stripe.Charge); break;
    case "charge.dispute.created": {
      const d=object as Stripe.Dispute; const chargeId=stripeId(d.charge); if(chargeId){const charge=await stripeClient(env).charges.retrieve(chargeId);const a=await userForCustomer(env,stripeId(charge.customer));if(a){await env.DB.prepare("INSERT OR REPLACE INTO billing_disputes(dispute_id,user_id,charge_id,status,created_at,updated_at) VALUES (?,?,?,?,COALESCE((SELECT created_at FROM billing_disputes WHERE dispute_id=?),?),?)").bind(d.id,a.user_id,chargeId,d.status,d.id,Date.now(),Date.now()).run();await freezeAccount(env,a.user_id);}} break;
    }
    case "charge.dispute.closed": {
      const d=object as Stripe.Dispute;const row=await env.DB.prepare("SELECT user_id FROM billing_disputes WHERE dispute_id=?").bind(d.id).first<{user_id:string}>();if(row){await env.DB.prepare("UPDATE billing_disputes SET status=?,updated_at=? WHERE dispute_id=?").bind(d.status,Date.now(),d.id).run();if(d.status==="won"){await env.DB.prepare("UPDATE billing_accounts SET frozen_at=NULL,updated_at=? WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM billing_disputes WHERE user_id=? AND status IN ('warning_needs_response','warning_under_review','needs_response','under_review'))").bind(Date.now(),row.user_id,row.user_id).run();}} break;
    }
  }
}
