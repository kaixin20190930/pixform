import type { Env } from "./cloudflare";

export function coloringOrigin(env: Env) { return env.APP_ORIGIN || "https://pixform.ai"; }
export function coloringPreview(env: Env) {
  if (env.COLORING_PREVIEW_ENABLED !== "true") return false;
  try { return ["http://localhost:3015", "http://127.0.0.1:3015", "https://pixform-coloring-preview.liukai19911010.workers.dev"].includes(coloringOrigin(env)); } catch { return false; }
}
export function coloringEnabled(env: Env) {
  const configured = env.BILLING_ENABLED === "true" && !!env.DB && !!env.MEDIA && !!env.FAL_KEY && (env.JOB_SIGNING_SECRET?.length || 0) >= 32;
  return configured && (coloringPreview(env) || env.COLORING_ENABLED === "true" && coloringOrigin(env) === "https://pixform.ai");
}
export function coloringPublished(env: Env) {
  return coloringEnabled(env) && env.COLORING_ENABLED === "true" && coloringOrigin(env) === "https://pixform.ai";
}
