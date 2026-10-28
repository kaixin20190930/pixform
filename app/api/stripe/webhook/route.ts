import Stripe from "stripe";
import { environment } from "@/lib/cloudflare";
import { stripeClient, stripeId } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/webhook";

export async function POST(request: Request) {
  const env = await environment();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return new Response("Not configured",{status:503});
  const signature=request.headers.get("stripe-signature"); if(!signature) return new Response("Missing signature",{status:400});
  let event: Stripe.Event;
  try { event=await stripeClient(env).webhooks.constructEventAsync(await request.text(),signature,env.STRIPE_WEBHOOK_SECRET,undefined,Stripe.createSubtleCryptoProvider()); }
  catch { return new Response("Invalid signature",{status:400}); }
  if(event.livemode!==env.STRIPE_SECRET_KEY.startsWith("sk_live_"))return new Response("Mode mismatch",{status:400});
  const object=event.data.object as {id?:string}; const now=Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO stripe_events (event_id,event_type,livemode,object_id,received_at) VALUES (?,?,?,?,?)").bind(event.id,event.type,event.livemode?1:0,object.id||stripeId(object),now).run();
  const stored=await env.DB.prepare("SELECT processed_at FROM stripe_events WHERE event_id=?").bind(event.id).first<{processed_at:number|null}>();
  if(stored?.processed_at) return new Response("ok");
  try { await processStripeEvent(env,event); await env.DB.prepare("UPDATE stripe_events SET processed_at=?,error_code=NULL WHERE event_id=?").bind(Date.now(),event.id).run(); return new Response("ok"); }
  catch(error) { const code=error instanceof Error ? error.message.slice(0,80):"UNKNOWN"; await env.DB.prepare("UPDATE stripe_events SET error_code=? WHERE event_id=?").bind(code,event.id).run(); return new Response("retry",{status:500}); }
}
