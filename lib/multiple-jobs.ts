import type { Env } from "./cloudflare";
import { ensureBillingAccount, reserveCredits, settleCredits } from "./billing/credits.ts";
import { finish, getJob, json, poll, representation, createPrediction, type Job } from "./jobs.ts";
import { digest, sign } from "./security.ts";
import { checkedBoxes, cropBox, decodePng, decodeResult, encodePng, extract, pasteResult, selectedCrops, type FaceBox } from "./multiple-image.ts";

type Manifest={job_id:string;children:string;crops:string;composing_at:number|null};
// A late poll cannot change a completed parent or reverse its settled credits.
async function finishParent(env:Env,parent:Job,status:"failed"|"succeeded",error:string|null=null){
  const now=Date.now();
  const row=await env.DB.prepare("UPDATE jobs SET status=?,error=?,completed_at=?,expires_at=? WHERE id=? AND status IN ('processing','saving') RETURNING *").bind(status,error,now,now+3600000,parent.id).first<Job>();
  const saved=row||await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(parent.id).first<Job>();
  if(saved){Object.assign(parent,saved);if(["succeeded","failed"].includes(saved.status))await settleCredits(env,parent.id,saved.status==="succeeded");}
  else await settleCredits(env,parent.id,false);
}
export function multipleReady(env:Env){return env.MULTIPLE_FACE_SWAP_ENABLED==="true"&&env.BILLING_ENABLED==="true"&&!!env.REPLICATE_API_TOKEN&&!!env.JOB_SIGNING_SECRET&&/^[a-f0-9]{64}$/.test(env.REPLICATE_MULTI_FACE_SWAP_VERSION||"");}
export async function generateMultiple(request:Request,env:Env){
  let parent:Job|undefined;
  try{
    if(!multipleReady(env))return json({error:"Multiple face swap is being prepared."},503);
    if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Start from the Pixform website."},403);
    const { currentSession }=await import("./session");const session=await currentSession(env,request.headers);if(!session)return json({error:"Sign in to swap faces.",code:"AUTH_REQUIRED"},401);
    const ip=request.headers.get("cf-connecting-ip");if(!ip)return json({error:"Connection could not be verified."},403);
    const max=21*1024*1024;let total=0;const chunks:Uint8Array[]=[];const reader=request.body?.getReader();if(!reader)return json({error:"Upload both photos."},400);
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();return json({error:"Choose smaller photos."},413);}chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
    const id=String(form.get("requestId")||"");if(!/^[a-f0-9-]{36}$/.test(id))return json({error:"Refresh the page and try again."},400);
    const old=await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<Job>();
    if(old){if(old.user_id!==session.user.id||old.style!=="multiple-face-swap")return json({error:"Request unavailable."},409);return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",old.expires_at),...await representation(env,old)},202);}
    if(form.get("consent")!=="true")return json({error:"Confirm permission for both photos and everyone depicted."},400);
    const image=form.get("image"),face=form.get("face");
    if(!(image instanceof File)||!(face instanceof File)||!image.size||!face.size||image.size>10*1024*1024||face.size>10*1024*1024)return json({error:"Each photo must be under 10 MB."},400);
    const original=decodePng(new Uint8Array(await image.arrayBuffer()));const reference=decodePng(new Uint8Array(await face.arrayBuffer()));
    let crops:FaceBox[],referenceCrop:FaceBox;
    try{const boxes=checkedBoxes(JSON.parse(String(form.get("boxes"))),original.width,original.height);crops=selectedCrops(boxes,JSON.parse(String(form.get("selected"))),original.width,original.height);const refs=checkedBoxes(JSON.parse(String(form.get("referenceBoxes"))),reference.width,reference.height);if(refs.length!==1)throw new Error("Use a reference photo with exactly one clear face.");referenceCrop=cropBox(refs[0],reference.width,reference.height);}catch(e){return json({error:e instanceof Error?e.message:"Detect the faces again."},400);}
    const now=Date.now();const ipHash=await digest(env.JOB_SIGNING_SECRET!,`multi:${ip}`);
    const allowed=await env.DB.prepare("INSERT INTO usage(id,ip_hash,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM usage WHERE ip_hash=? AND created_at>?)<10 RETURNING id").bind(id,ipHash,now,ipHash,now-3600000).first();if(!allowed)return json({error:"Too many requests. Please wait and try again."},429);
    await ensureBillingAccount(env,session.user.id);const credits=crops.length*2;
    if(!await reserveCredits(env,{jobId:id,userId:session.user.id,tool:"multiple-face-swap",credits}))return json({error:`You need ${credits} credits for these faces.`,code:"INSUFFICIENT_CREDITS"},402);
    parent={id,prediction_id:null,status:"processing",style:"multiple-face-swap",attempts:1,created_at:now,expires_at:now+7200000,output_key:null,output_type:null,error:null,user_id:session.user.id,tool:"multiple-face-swap",credits_reserved:credits};
    const children=crops.map(()=>crypto.randomUUID());
    await env.DB.batch([
      env.DB.prepare("INSERT INTO jobs(id,status,style,attempts,created_at,expires_at,user_id,tool,credits_reserved) VALUES (?,'processing','multiple-face-swap',1,?,?,?,'multiple-face-swap',?)").bind(id,now,parent.expires_at,session.user.id,credits),
      ...children.map(child=>env.DB.prepare("INSERT INTO jobs(id,status,style,attempts,created_at,expires_at,user_id,tool,credits_reserved) VALUES (?,'pending','face-crop',1,?,?,?,'multiple-face-swap',0)").bind(child,now,parent!.expires_at,session.user.id)),
      env.DB.prepare("INSERT INTO multiple_face_jobs(job_id,children,crops) VALUES (?,?,?)").bind(id,JSON.stringify(children),JSON.stringify(crops)),
    ]);
    const faceBytes=encodePng(extract(reference,referenceCrop));
    await env.MEDIA.put(`input/${id}`,encodePng(original),{httpMetadata:{contentType:"image/png"}});
    for(let i=0;i<children.length;i++){
      await env.MEDIA.put(`input/${children[i]}`,encodePng(extract(original,crops[i])),{httpMetadata:{contentType:"image/png"}});
      await env.MEDIA.put(`face/${children[i]}`,faceBytes,{httpMetadata:{contentType:"image/png"}});
    }
    // The manifest remains unready until all crops have been uploaded.
    await env.DB.prepare("UPDATE multiple_face_jobs SET composing_at=0 WHERE job_id=?").bind(id).run();
    return json({token:await sign(env.JOB_SIGNING_SECRET!,id,"job",parent.expires_at),status:"processing",faceCount:children.length,credits},202);
  }catch(e){if(parent)await finishParent(env,parent,"failed","We couldn't prepare these photos. Your credits were returned.");return json({error:parent?"We couldn't prepare these photos. Your credits were returned.":"Please use clear photos and try again."},503);}
}

export async function pollMultiple(env:Env,parent:Job,origin:string){
  if(!["processing","saving"].includes(parent.status))return;
  const manifest=await env.DB.prepare("SELECT * FROM multiple_face_jobs WHERE job_id=?").bind(parent.id).first<Manifest>();if(!manifest||manifest.composing_at===null)return;
  const ids=JSON.parse(manifest.children) as string[],crops=JSON.parse(manifest.crops) as FaceBox[];
  const children=[] as Job[];
  for(const id of ids){const child=await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first<Job>();if(!child){await finishParent(env,parent,"failed","A face result expired. Your credits were returned.");return;}children.push(child);}
  if(children.some(c=>c.status==="failed")){await finishParent(env,parent,"failed","One of the selected faces could not be swapped. All reserved credits were returned.");return;}
  for(const child of children){
    if(child.status==="pending"){
      const lock=await env.DB.prepare("UPDATE jobs SET status='submitting',created_at=? WHERE id=? AND status='pending' RETURNING id").bind(Date.now(),child.id).first();if(!lock)return;
      try{const p=await createPrediction(env,child,origin);await env.DB.prepare("UPDATE jobs SET prediction_id=?,status='starting' WHERE id=?").bind(p.id,child.id).run();}catch{await finish(env,child,"failed","Couldn't confirm this face swap.");await finishParent(env,parent,"failed","Couldn't start a selected face. Your credits were returned.");}return;
    }
    if(child.status==="submitting"||child.status==="saving"||child.status==="retrying"){
      if(Date.now()-child.created_at>600000)await finishParent(env,parent,"failed","A selected face timed out. Your credits were returned.");return;
    }
    if(child.status!=="succeeded"){await poll(env,child,origin);if(child.status==="failed")await finishParent(env,parent,"failed","A selected face failed. Your credits were returned.");return;}
  }
  const claimed=await env.DB.prepare("UPDATE multiple_face_jobs SET composing_at=? WHERE job_id=? AND (composing_at=0 OR composing_at<?) RETURNING job_id").bind(Date.now(),parent.id,Date.now()-120000).first();if(!claimed)return;
  await env.DB.prepare("UPDATE jobs SET status='saving' WHERE id=? AND status='processing'").bind(parent.id).run();
  try{
    const original=await env.MEDIA.get(`input/${parent.id}`);if(!original)throw new Error("Missing original");const base=decodePng(new Uint8Array(await original.arrayBuffer()));
    for(let i=0;i<children.length;i++){const obj=await env.MEDIA.get(children[i].output_key!);if(!obj)throw new Error("Missing face");pasteResult(base,decodeResult(new Uint8Array(await obj.arrayBuffer())),crops[i]);}
    const key=`output/${parent.id}`;await env.MEDIA.put(key,encodePng(base),{httpMetadata:{contentType:"image/png"}});
    await env.DB.prepare("UPDATE jobs SET output_key=?,output_type='image/png' WHERE id=?").bind(key,parent.id).run();parent.output_key=key;parent.output_type="image/png";await finishParent(env,parent,"succeeded");
  }catch{await finishParent(env,parent,"failed","We couldn't combine all selected faces. Your credits were returned.");}
}
export async function multipleStatus(request:Request,env:Env){
  const job=await getJob(env,request.headers.get("authorization")?.replace(/^Bearer /,"")||"");if(!job||job.style!=="multiple-face-swap")return json({error:"Result unavailable or expired."},404);
  await pollMultiple(env,job,new URL(request.url).origin);return json(await representation(env,job));
}
