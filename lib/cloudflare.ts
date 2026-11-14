import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  FAL_KEY?: string;
  TEXT_REMOVER_PREVIEW_ENABLED?: string;
  COLORING_PREVIEW_ENABLED?: string;
  COLORING_ENABLED?: string;
  APP_ORIGIN?: string;
  MEDIA: R2Bucket;
  REPLICATE_API_TOKEN?: string;
  REPLICATE_SDXL_VERSION?: string;
  REPLICATE_FACE_SWAP_VERSION?: string;
  REPLICATE_MULTI_FACE_SWAP_VERSION?: string;
  MULTIPLE_FACE_SWAP_ENABLED?: string;
  JOB_SIGNING_SECRET?: string;
  GENERATION_ENABLED?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  BILLING_ENABLED?: string;
};
export async function environment(): Promise<Env> {
  return (await getCloudflareContext({ async: true })).env as unknown as Env;
}
export function authReady(env: Env) {
  return (env.BETTER_AUTH_SECRET?.length || 0) >= 32 && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET && !!env.DB;
}
export function billingReady(env: Env) {
  return env.BILLING_ENABLED === "true" && authReady(env) && !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET;
}
export function ready(env: Env, faceSwap = false) {
  return env.GENERATION_ENABLED === "true" && !!env.DB && !!env.MEDIA && !!env.REPLICATE_API_TOKEN &&
    /^[a-f0-9]{64}$/.test((faceSwap ? env.REPLICATE_FACE_SWAP_VERSION : env.REPLICATE_SDXL_VERSION) || "") && (env.JOB_SIGNING_SECRET?.length || 0) >= 32;
}
