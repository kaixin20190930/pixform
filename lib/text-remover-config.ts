import type { Env } from "./cloudflare";
export function textRemoverEnabled(env: Env) {
  return env.TEXT_REMOVER_PREVIEW_ENABLED === "true" && env.APP_ORIGIN === "https://pixform-text-preview.liukai19911010.workers.dev" && env.BILLING_ENABLED === "true" && !!env.DB && !!env.MEDIA && !!env.REPLICATE_API_TOKEN && (env.JOB_SIGNING_SECRET?.length || 0) >= 32;
}
