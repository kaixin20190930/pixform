import type { Env } from "./cloudflare";
const PREVIEW_ORIGIN="https://pixform-text-preview.liukai19911010.workers.dev";
export function textRemoverPreview(env:Env){return env.TEXT_REMOVER_PREVIEW_ENABLED==="true" && env.APP_ORIGIN===PREVIEW_ORIGIN;}
export function textRemoverEnabled(env:Env){
 const configured=env.BILLING_ENABLED==="true" && !!env.DB && !!env.MEDIA && !!env.REPLICATE_API_TOKEN && (env.JOB_SIGNING_SECRET?.length||0)>=32;
 return configured && (textRemoverPreview(env) || env.TEXT_REMOVER_ENABLED==="true" && (env.APP_ORIGIN||"https://pixform.ai")==="https://pixform.ai");
}
export function textRemoverPublished(env:Env){return textRemoverEnabled(env) && env.TEXT_REMOVER_ENABLED==="true" && (env.APP_ORIGIN||"https://pixform.ai")==="https://pixform.ai";}
