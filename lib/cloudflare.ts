import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  REPLICATE_API_TOKEN?: string;
  REPLICATE_SDXL_VERSION?: string;
  REPLICATE_FACE_SWAP_VERSION?: string;
  JOB_SIGNING_SECRET?: string;
  GENERATION_ENABLED?: string;
};
export async function environment(): Promise<Env> {
  return (await getCloudflareContext({ async: true })).env as unknown as Env;
}
export function ready(env: Env, faceSwap = false) {
  return env.GENERATION_ENABLED === "true" && !!env.DB && !!env.MEDIA && !!env.REPLICATE_API_TOKEN &&
    /^[a-f0-9]{64}$/.test((faceSwap ? env.REPLICATE_FACE_SWAP_VERSION : env.REPLICATE_SDXL_VERSION) || "") && (env.JOB_SIGNING_SECRET?.length || 0) >= 32;
}
