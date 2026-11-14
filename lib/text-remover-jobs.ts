import type { Env } from "./cloudflare";
import { finish, json, representation, provider, type Job } from "./jobs.ts";
import { allowedOutput, digest, sign, MAX_BODY_BYTES, MAX_IMAGE_BYTES } from "./security.ts";
import { ensureBillingAccount, reserveCredits, settleCredits } from "./billing/credits.ts";
import { TOOL_RATES } from "./billing/catalog.ts";
import { textImages, mergeTextResult } from "./text-remover-image.ts";
export const TEXT_TOOL="text-remover";
export const TEXT_VERSION="cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72";
export async function startTextRemover(env: Env, request: Request, userId: string) {
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
  const maskFile=form.get("mask"); if(!(maskFile instanceof File)||!maskFile.size||maskFile.size>MAX_IMAGE_BYTES)return json({error:"Brush over the text first."},400);
  const mask=new Uint8Array(await maskFile.arrayBuffer());

  try { textImages(data,mask); } catch { return json({error:"The prepared photo is invalid. Choose another JPG, PNG or WEBP image."},400); }
  const existing = await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<Job>();
  if (existing) {
    if (existing.user_id !== userId || existing.tool !== TEXT_TOOL) return json({error:"Choose another request."},409);
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
  const credits = TOOL_RATES["text-remover"];
  if (!await reserveCredits(env,{jobId:id,userId,tool:TEXT_TOOL,credits})) return json({error:"You need 1 credit for this generation.",code:"INSUFFICIENT_CREDITS"},402);
  const job: Job = {id,prediction_id:null,status:"starting",style:TEXT_TOOL,attempts:1,created_at:now,expires_at:now+7200000,output_key:null,output_type:null,error:null,user_id:userId,tool:TEXT_TOOL,credits_reserved:credits};
  try {
    await env.DB.prepare("INSERT INTO jobs (id,status,style,attempts,created_at,expires_at,user_id,tool,credits_reserved) VALUES (?,'starting',?,1,?,?,?,?,?)").bind(id,TEXT_TOOL,now,job.expires_at,userId,TEXT_TOOL,credits).run();
    await env.MEDIA.put(`input/${id}`,data,{httpMetadata:{contentType:"image/png"}});
    await env.MEDIA.put(`face/${id}`,mask,{httpMetadata:{contentType:"image/png"}});
    const inputToken=await sign(env.JOB_SIGNING_SECRET!,id,"input",job.expires_at), maskToken=await sign(env.JOB_SIGNING_SECRET!,id,"face",job.expires_at);
    const submitted=await provider(env,"predictions",{method:"POST",headers:{"Cancel-After":"5m"},body:JSON.stringify({version:TEXT_VERSION,input:{image:`${origin}/api/media/${inputToken}`,mask:`${origin}/api/media/${maskToken}`}})});
    await env.DB.prepare("UPDATE jobs SET prediction_id=? WHERE id=?").bind(submitted.id,id).run();
  } catch {
    // Never repeat an uncertain POST: it could already have incurred provider charges.
    if (await env.DB.prepare("SELECT id FROM jobs WHERE id=?").bind(id).first()) await finish(env,job,"failed","We couldn't confirm generation started. Reserved credits were returned. Check this request before starting another.");
    else await settleCredits(env,id,false);
    return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",job.expires_at),...await representation(env,job)},202);
  }
  return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",job.expires_at),status:"starting"},202);
}

export async function pollTextRemover(env:Env,job:Job){
 if(!job.prediction_id||!["starting","processing"].includes(job.status))return;
 const prediction=await provider(env,`predictions/${encodeURIComponent(job.prediction_id)}`);
 if(["failed","canceled","aborted"].includes(prediction.status)){await finish(env,job,"failed","The edit failed. Your 1 credit was returned.");return;}
 if(prediction.status!=="succeeded")return;
 const url=allowedOutput(Array.isArray(prediction.output)?prediction.output[0]:prediction.output);
 if(!url){await finish(env,job,"failed","Invalid result. Your 1 credit was returned.");return;}
 const lock=await env.DB.prepare("UPDATE jobs SET status='saving' WHERE id=? AND status IN ('starting','processing') RETURNING id").bind(job.id).first();if(!lock)return;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:"manual"});if(!response.ok)throw new Error("Missing result");
  const reader=response.body?.getReader();if(!reader)throw new Error("Missing body");
  const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new Error("Large result");}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const input=await env.MEDIA.get(`input/${job.id}`),mask=await env.MEDIA.get(`face/${job.id}`);if(!input||!mask)throw new Error("Expired input");
  const output=mergeTextResult(new Uint8Array(await input.arrayBuffer()),new Uint8Array(await mask.arrayBuffer()),bytes),key=`output/${job.id}`;
  await env.MEDIA.put(key,output,{httpMetadata:{contentType:"image/png"}});
  await env.DB.prepare("UPDATE jobs SET output_key=?,output_type='image/png' WHERE id=?").bind(key,job.id).run();
  await finish(env,job,"succeeded");job.output_key=key;job.output_type="image/png";
 }catch{await finish(env,job,"failed","We couldn't save this edit. Your 1 credit was returned.");}
}
