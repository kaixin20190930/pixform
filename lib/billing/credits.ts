import type { Env } from "../cloudflare";
import type { ToolKey } from "./catalog";

export type Balance = {
  subscription_credits: number; permanent_credits: number; plan_key: string | null;
  subscription_status: string | null; current_period_end: number | null; cancel_at_period_end: number;
  stripe_customer_id: string | null;
};

export async function ensureBillingAccount(env: Env, userId: string) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO billing_accounts (user_id, updated_at) VALUES (?, ?)").bind(userId, now),
    env.DB.prepare("INSERT OR IGNORE INTO credit_grants (id,user_id,bucket,source,credits,reset_existing,external_ref,created_at) VALUES (?,?, 'permanent','signup',10,0,?,?)")
      .bind(crypto.randomUUID(), userId, `signup:${userId}`, now),
  ]);
}

export async function balance(env: Env, userId: string) {
  await ensureBillingAccount(env, userId);
  return env.DB.prepare("SELECT subscription_credits,permanent_credits,plan_key,subscription_status,current_period_end,cancel_at_period_end,stripe_customer_id FROM billing_accounts WHERE user_id=?")
    .bind(userId).first<Balance>();
}

export async function reserveCredits(env: Env, input: { jobId: string; userId: string; tool: ToolKey; credits: number }) {
  const row = await env.DB.prepare(`INSERT INTO credit_reservations
    (job_id,user_id,tool,credits,subscription_used,permanent_used,state,created_at)
    SELECT ?,user_id,?,?,min(subscription_credits,?),?-min(subscription_credits,?),'reserved',?
    FROM billing_accounts WHERE user_id=? AND frozen_at IS NULL AND subscription_credits+permanent_credits>=?
    RETURNING job_id`).bind(input.jobId,input.userId,input.tool,input.credits,input.credits,input.credits,input.credits,Date.now(),input.userId,input.credits).first();
  return !!row;
}

export async function settleCredits(env: Env, jobId: string, succeeded: boolean) {
  return env.DB.prepare("UPDATE credit_reservations SET state=?,resolved_at=? WHERE job_id=? AND state='reserved' RETURNING job_id")
    .bind(succeeded ? "captured" : "released", Date.now(), jobId).first();
}

export async function grantCredits(env: Env, input: { userId: string; bucket: "subscription"|"permanent"; source: string; credits: number; externalRef: string; reset?: boolean; expiresAt?: number|null }) {
  return env.DB.prepare(`INSERT OR IGNORE INTO credit_grants
    (id,user_id,bucket,source,credits,reset_existing,external_ref,expires_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`).bind(crypto.randomUUID(),input.userId,input.bucket,input.source,input.credits,input.reset ? 1 : 0,input.externalRef,input.expiresAt ?? null,Date.now()).first();
}

export async function expireSubscriptionCredits(env: Env, userId: string, externalRef: string) {
  const b = await env.DB.prepare("SELECT subscription_credits FROM billing_accounts WHERE user_id=?").bind(userId).first<{subscription_credits:number}>();
  if (!b) return;
  await env.DB.prepare("INSERT OR IGNORE INTO subscription_expirations (external_ref,user_id,credits,created_at) VALUES (?,?,?,?)")
    .bind(externalRef,userId,b.subscription_credits,Date.now()).run();
}

export async function freezeAccount(env: Env, userId: string) {
  await env.DB.prepare("UPDATE billing_accounts SET frozen_at=COALESCE(frozen_at,?),updated_at=? WHERE user_id=?").bind(Date.now(),Date.now(),userId).run();
}
