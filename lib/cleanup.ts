import type { Env } from "./cloudflare";
import { poll, type Job } from "./jobs.ts";

export async function sweep(env: Env) {
  // Finish jobs even when the user closes the tab. Tokens never extend retention.
  const active = await env.DB.prepare("SELECT * FROM jobs WHERE status IN ('starting','processing') AND prediction_id IS NOT NULL AND expires_at > ? ORDER BY created_at LIMIT 20").bind(Date.now()).all<Job>();
  for (const job of active.results) {
    try { await poll(env, job, "https://pixform.ai"); } catch { /* Retry read-only reconciliation next minute. */ }
  }
  const expired = await env.DB.prepare("SELECT id,status,credits_reserved FROM jobs WHERE expires_at <= ? LIMIT 100").bind(Date.now()).all<{ id: string; status:string; credits_reserved:number }>();
  for (const { id,status,credits_reserved } of expired.results) {
    if (credits_reserved) {
      const { settleCredits } = await import("./billing/credits.ts");
      await settleCredits(env,id,status === "succeeded");
    }
    // Never remove the record until all uploaded and output objects are deleted, so cleanup can retry.
    await env.MEDIA.delete([`input/${id}`, `face/${id}`, `output/${id}`]);
    await env.DB.prepare("DELETE FROM jobs WHERE id = ? AND expires_at <= ?").bind(id, Date.now()).run();
  }
  await env.DB.prepare("DELETE FROM usage WHERE created_at <= ?").bind(Date.now() - 3600000).run();
  const orphaned = await env.DB.prepare("SELECT job_id FROM credit_reservations WHERE state='reserved' AND created_at<=? AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.id=credit_reservations.job_id) LIMIT 100").bind(Date.now()-7200000).all<{job_id:string}>();
  if (orphaned.results.length) { const { settleCredits } = await import("./billing/credits.ts"); for (const row of orphaned.results) await settleCredits(env,row.job_id,false); }
  const ended=await env.DB.prepare("SELECT user_id,stripe_subscription_id FROM billing_accounts WHERE subscription_credits>0 AND current_period_end<=? AND subscription_status IN ('past_due','unpaid','canceled','incomplete_expired') LIMIT 100").bind(Date.now()).all<{user_id:string;stripe_subscription_id:string|null}>();
  if(ended.results.length){const {expireSubscriptionCredits}=await import("./billing/credits.ts");for(const row of ended.results)await expireSubscriptionCredits(env,row.user_id,`period_ended:${row.stripe_subscription_id||row.user_id}`);}
}
