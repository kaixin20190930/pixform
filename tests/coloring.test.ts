import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { encode, decode } from "fast-png";
import { startColoring, pollColoring, coloringEnabled, falImageUrl } from "../lib/coloring-jobs.ts";
import { blackWhitePng } from "../lib/coloring-image.ts";
import { sweep } from "../lib/cleanup.ts";
import type { Env } from "../lib/cloudflare.ts";
import type { Job } from "../lib/jobs.ts";

function fixture() {
  const db=new DatabaseSync(":memory:");
  for (const name of ["0001_initial.sql","0002_daily_metrics.sql","0003_auth_billing.sql","0004_billing_safety.sql","0005_multiple_face_swap.sql"]) db.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  function prepare(sql:string) {
    let args:unknown[]=[];
    return {bind(...values:unknown[]){args=values;return this;},async first(){return db.prepare(sql).get(...args as never[])||null;},async all(){return {results:db.prepare(sql).all(...args as never[])};},async run(){return db.prepare(sql).run(...args as never[]);}};
  }
  const objects=new Map<string,Uint8Array>();
  const env={DB:{prepare,async batch(statements:{run:()=>unknown}[]){return Promise.all(statements.map(s=>s.run()));}},MEDIA:{async put(key:string,value:Uint8Array){objects.set(key,value);},async delete(keys:string[]){keys.forEach(key=>objects.delete(key));}},FAL_KEY:"test",JOB_SIGNING_SECRET:"p".repeat(64),COLORING_PREVIEW_ENABLED:"true",BILLING_ENABLED:"true",APP_ORIGIN:"http://localhost:3015"} as unknown as Env;
  const balance=()=>Number(db.prepare("SELECT permanent_credits FROM billing_accounts WHERE user_id='test-user'").get()?.permanent_credits || 0);
  const getJob=(id:string)=>db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as Job;
  const image=encode({width:256,height:256,depth:8,channels:3,data:new Uint8Array(256*256*3).fill(100)});
  function request(id:string){const form=new FormData();form.set("requestId",id);form.set("image",new Blob([new Uint8Array(image)],{type:"image/png"}),"photo.png");return new Request("http://localhost:3015/api/photo-to-coloring-page",{method:"POST",headers:{origin:"http://localhost:3015"},body:form});}
  return {env,db,objects,balance,getJob,request};
}
function output() {const data=new Uint8Array(256*256*3).fill(255);data.fill(0,0,256*3);return encode({width:256,height:256,depth:8,channels:3,data});}

test("coloring is preview-only and rejects external output URLs",()=>{
  const f=fixture();assert.equal(coloringEnabled(f.env),true);assert.equal(coloringEnabled({...f.env,APP_ORIGIN:"https://pixform.ai"}),false);assert.equal(coloringEnabled({...f.env,COLORING_PREVIEW_ENABLED:undefined}),false);
  assert.throws(()=>falImageUrl("http://v3.fal.media/result.png"));assert.throws(()=>falImageUrl("https://fal.media.attacker.test/result.png"));assert.throws(()=>falImageUrl("https://user:pass@fal.media/x"));f.db.close();
});

test("coloring generates once, captures 2 credits, and persists a black-white PNG",async()=>{
  const f=fixture(), original=globalThis.fetch;let submits=0;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(init?.method==="POST"){submits++;const payload=JSON.parse(String(init.body));assert.equal(payload.num_images,1);assert.equal(payload.num_inference_steps,4);assert.equal(payload.enable_safety_checker,true);return Response.json({request_id:"test-fal-request"});}
    if(path.endsWith("/status"))return Response.json({status:"COMPLETED"});
    if(path.includes("/requests/"))return Response.json({images:[{url:"https://v3.fal.media/result.png"}],has_nsfw_concepts:[false]});
    return new Response(new Uint8Array(output()),{headers:{"Content-Type":"image/png"}});
  };
  try {
    const id=crypto.randomUUID();const [a,b]=await Promise.all([startColoring(f.env,f.request(id),"test-user"),startColoring(f.env,f.request(id),"test-user")]);assert.equal(a.status,202);assert.ok([202,429].includes(b.status));
    assert.equal(submits,1);assert.equal(f.balance(),8);
    // The actual background sweep must dispatch to fal, not Replicate.
    await sweep(f.env);
    const job=f.getJob(id);assert.equal(job.status,"succeeded");assert.equal(job.output_type,"image/png");
    assert.equal(f.db.prepare("SELECT state FROM credit_reservations WHERE job_id=?").get(id)?.state,"captured");
    const png=decode(f.objects.get(`output/${id}`)!);assert.ok([...png.data].every(v=>v===0||v===255));
    await pollColoring(f.env,job);await startColoring(f.env,f.request(id),"test-user");assert.equal(submits,1);assert.equal(f.balance(),8);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM credit_ledger WHERE reason='generation_reserve'").get()?.n,1);
    const other=await startColoring(f.env,f.request(id),"other-user");assert.equal(other.status,409);
  } finally {globalThis.fetch=original;f.db.close();}
});

test("failed, blank, uncertain and expired jobs release exactly once; insufficient funds never call fal",async()=>{
  const f=fixture(), original=globalThis.fetch;let submits=0, mode="failure";
  globalThis.fetch=async(url,init)=>{
    if(init?.method==="POST"){submits++;if(mode==="uncertain")throw new Error("network timeout");return Response.json({request_id:"failure-request"});}
    if(String(url).endsWith("/status"))return Response.json(mode==="failure"?{status:"COMPLETED",error:"Model rejected input"}:{status:"COMPLETED"});
    if(String(url).includes("/requests/"))return Response.json({images:[{url:"https://v3.fal.media/blank.png"}]});
    return new Response(new Uint8Array(encode({width:256,height:256,depth:8,channels:3,data:new Uint8Array(256*256*3).fill(255)})),{headers:{"Content-Type":"image/png"}});
  };
  try {
    for(const nextMode of ["failure","blank","uncertain","expiry"]){
      mode=nextMode;const id=crypto.randomUUID();await startColoring(f.env,f.request(id),"test-user");
      if(mode==="expiry"){f.db.prepare("UPDATE jobs SET expires_at=? WHERE id=?").run(Date.now()-1,id);await sweep(f.env);}else {await pollColoring(f.env,f.getJob(id));await pollColoring(f.env,f.getJob(id));}
      assert.equal(f.balance(),10,mode);assert.equal(f.db.prepare("SELECT state FROM credit_reservations WHERE job_id=?").get(id)?.state,"released");
      assert.equal(f.db.prepare("SELECT count(*) AS n FROM credit_ledger WHERE reason='generation_release' AND ref_id=?").get(id)?.n,1);
    }
    f.db.prepare("UPDATE billing_accounts SET permanent_credits=1 WHERE user_id='test-user'").run();const before=submits;const r=await startColoring(f.env,f.request(crypto.randomUUID()),"test-user");assert.equal(r.status,402);assert.equal(submits,before);
  } finally {globalThis.fetch=original;f.db.close();}
});

test("binary conversion flattens alpha onto white and rejects empty results",()=>{
  const bytes=encode({width:2,height:1,depth:8,channels:4,data:new Uint8Array([0,0,0,0,0,0,0,255])});
  assert.deepEqual([...decode(blackWhitePng(bytes)).data],[255,255,255,0,0,0]);
  assert.throws(()=>blackWhitePng(encode({width:2,height:1,depth:8,channels:3,data:new Uint8Array(6).fill(255)})));
});
