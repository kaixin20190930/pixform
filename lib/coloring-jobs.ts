import type { Env } from "./cloudflare";
import { finish, json, representation, type Job } from "./jobs.ts";
import { digest, sign, MAX_BODY_BYTES, MAX_IMAGE_BYTES } from "./security.ts";
import { ensureBillingAccount, reserveCredits, settleCredits } from "./billing/credits.ts";
import { TOOL_RATES } from "./billing/catalog.ts";
import { coloringImage, blackWhitePng } from "./coloring-image.ts";
export { coloringEnabled } from "./coloring-config.ts";

export const COLORING_TOOL = "photo-to-coloring-page";
export const COLORING_MODEL = "fal-ai/flux-2/klein/4b/edit";
export const COLORING_PROMPT = "Convert this exact photo into a clean printable coloring book page. Preserve the main subject, its identity, pose, proportions, and composition. Draw only smooth continuous black outlines on a pure white background, with large empty enclosed regions for coloring. Simplify small textures and background clutter. No pencil sketch, no hatching, no crosshatching, no shading, no gray fill, no color, no gradients, no solid black areas, no text or border. Keep every main subject complete and recognizable.";

class FalError extends Error { status: number; constructor(status: number) { super(`Fal HTTP ${status}`); this.status=status; } }
async function fal(env: Env, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://queue.fal.run/${path}`, { ...init, headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json", "X-Fal-No-Retry": "1", "X-Fal-Request-Start-Timeout": "120", "X-Fal-Store-IO": "0", "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }), ...init.headers }, signal: AbortSignal.timeout(20000), redirect: "manual", cache: "no-store" });
  if (!response.ok) throw new FalError(response.status);
  return response.json();
}
function requestPath(id: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error("Invalid request id");
  // Queue retrieval uses owner/app, not the complete model endpoint.
  return `fal-ai/flux-2/requests/${id}`;
}
export function falImageUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Missing result");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"))) throw new Error("Invalid result host");
  return url.href;
}

// User identity is supplied only by the authenticated route, never by the form.
export async function startColoring(env: Env, request: Request, userId: string) {
  const origin = new URL(request.url).origin;
  const reader = request.body?.getReader();
  if (!reader) return json({error:"Choose a photo."},400);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break; length += value.length; if (length > MAX_BODY_BYTES) { await reader.cancel(); return json({error:"Choose a photo under 10 MB."},413); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  let form: FormData;
  try { form = await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type") || ""}}).formData(); } catch { return json({error:"Choose a valid photo."},400); }
  const file = form.get("image"), id = String(form.get("requestId") || "");
  if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES || file.type !== "image/png" || !/^[a-f0-9-]{36}$/.test(id)) return json({error:"Choose a photo and prepare it again."},400);
  const data = new Uint8Array(await file.arrayBuffer());
  let image: ReturnType<typeof coloringImage>;
  try { image = coloringImage(data,768); } catch { return json({error:"The prepared photo is invalid. Choose another JPG, PNG or WEBP image."},400); }
  const existing = await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<Job>();
  if (existing) {
    if (existing.user_id !== userId || existing.tool !== COLORING_TOOL) return json({error:"Choose another request."},409);
    if (existing.expires_at <= Date.now()) return json({error:"This request has expired. Start a new generation."},410);
    return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",existing.expires_at),...await representation(env,existing)},202);
  }
  const now=Date.now();
  const ip = request.headers.get("cf-connecting-ip") || (new URL(origin).hostname === "localhost" ? "local-preview" : "");
  if (!ip) return json({error:"The connection could not be verified."},403);
  const ipHash = await digest(env.JOB_SIGNING_SECRET!,`ip:${ip}`);
  const allowed = await env.DB.prepare("INSERT OR IGNORE INTO usage (id,ip_hash,created_at) SELECT ?,?,? WHERE (SELECT count(*) FROM usage WHERE ip_hash=? AND created_at>?)<60 RETURNING id").bind(id,ipHash,now,ipHash,now-3600000).first();
  if (!allowed) return json({error:"Request already received or too many requests. Check the same request again shortly."},429);
  await ensureBillingAccount(env,userId);
  const credits = TOOL_RATES[COLORING_TOOL];
  if (!await reserveCredits(env,{jobId:id,userId,tool:COLORING_TOOL,credits})) return json({error:"You need 2 credits for this generation.",code:"INSUFFICIENT_CREDITS"},402);
  const job: Job = {id,prediction_id:null,status:"starting",style:COLORING_TOOL,attempts:1,created_at:now,expires_at:now+7200000,output_key:null,output_type:null,error:null,user_id:userId,tool:COLORING_TOOL,credits_reserved:credits};
  try {
    await env.DB.prepare("INSERT INTO jobs (id,status,style,attempts,created_at,expires_at,user_id,tool,credits_reserved) VALUES (?,'starting',?,1,?,?,?,?,?)").bind(id,COLORING_TOOL,now,job.expires_at,userId,COLORING_TOOL,credits).run();
    await env.MEDIA.put(`input/${id}`,data,{httpMetadata:{contentType:"image/png"}});
    // Data URI also works on isolated localhost; the normalized image is bounded to 768px.
    const submitted = await fal(env,COLORING_MODEL,{method:"POST",body:JSON.stringify({prompt:COLORING_PROMPT,seed:20261114,num_inference_steps:4,num_images:1,image_size:{width:Math.max(256,Math.floor(image.width/16)*16),height:Math.max(256,Math.floor(image.height/16)*16)},enable_safety_checker:true,output_format:"png",image_urls:[`data:image/png;base64,${Buffer.from(data).toString("base64")}`]})});
    requestPath(submitted.request_id);
    await env.DB.prepare("UPDATE jobs SET prediction_id=? WHERE id=?").bind(submitted.request_id,id).run();
  } catch {
    // Never repeat an uncertain POST: it could already have incurred provider charges.
    if (await env.DB.prepare("SELECT id FROM jobs WHERE id=?").bind(id).first()) await finish(env,job,"failed","We couldn't confirm generation started. Reserved credits were returned. Check this request before starting another.");
    else await settleCredits(env,id,false);
    return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",job.expires_at),...await representation(env,job)},202);
  }
  return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",job.expires_at),status:"starting"},202);
}

export async function pollColoring(env: Env, job: Job) {
  if (!job.prediction_id || !["starting","processing"].includes(job.status)) return;
  const path = requestPath(job.prediction_id);
  const status = await fal(env,`${path}/status`);
  if (status.status !== "COMPLETED") return;
  if (status.error || status.error_type) { await finish(env,job,"failed","The model couldn't process this photo. Your 2 credits were returned."); return; }
  let result;
  try { result = await fal(env,path); } catch (error) {
    if (error instanceof FalError && [400,422].includes(error.status)) { await finish(env,job,"failed","The model couldn't process this photo. Your 2 credits were returned."); return; }
    throw error; // Temporary read failures are reconciled without resubmitting the model.
  }
  const lock = await env.DB.prepare("UPDATE jobs SET status='saving' WHERE id=? AND status IN ('starting','processing') RETURNING id").bind(job.id).first();
  if (!lock) return;
  try {
    if (result.has_nsfw_concepts?.some((v:boolean)=>v)) throw new Error("Safety rejection");
    const response = await fetch(falImageUrl(result.images?.[0]?.url),{signal:AbortSignal.timeout(20000),redirect:"manual"});
    if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") throw new Error("Invalid PNG");
    const reader = response.body?.getReader(); if (!reader) throw new Error("Missing result");
    const chunks:Uint8Array[]=[]; let total=0;
    while(true) {const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_IMAGE_BYTES){await reader.cancel();throw new Error("Large result");}chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const output = blackWhitePng(bytes), key=`output/${job.id}`;
    await env.MEDIA.put(key,output,{httpMetadata:{contentType:"image/png"}});
    await env.DB.prepare("UPDATE jobs SET output_key=?,output_type='image/png' WHERE id=?").bind(key,job.id).run();
    await finish(env,job,"succeeded"); job.output_key=key;job.output_type="image/png";
    job.expires_at=Date.now()+3600000;
  } catch { await finish(env,job,"failed","We couldn't save a valid coloring page. Your 2 credits were returned."); }
}
