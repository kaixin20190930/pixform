import { environment,billingReady } from "@/lib/cloudflare";
import { currentSession } from "@/lib/session";
import { json } from "@/lib/jobs";
export async function GET(request:Request){const env=await environment();if(!billingReady(env))return json({error:"Billing is not enabled."},503);const session=await currentSession(env,request.headers);if(!session)return json({error:"Sign in required."},401);const id=new URL(request.url).searchParams.get("session_id");if(!id)return json({error:"Missing checkout session."},400);const order=await env.DB.prepare("SELECT status,offer_key,credits FROM billing_orders WHERE stripe_checkout_session_id=? AND user_id=?").bind(id,session.user.id).first();return order?json(order):json({error:"Order not found."},404);}
