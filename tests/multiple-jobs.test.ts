import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pollMultiple } from "../lib/multiple-jobs.ts";
import { reserveCredits } from "../lib/billing/credits.ts";
import { decodePng, encodePng, padFaceCrop } from "../lib/multiple-image.ts";
import type { Env } from "../lib/cloudflare.ts";
import type { Job } from "../lib/jobs.ts";

async function fixture(count:number) {
 const db=new DatabaseSync(":memory:");
 for(const file of ["0001_initial.sql","0002_daily_metrics.sql","0003_auth_billing.sql","0004_billing_safety.sql","0005_multiple_face_swap.sql"])db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),"utf8"));
 const objects=new Map<string,Uint8Array>();
 const env={DB:{prepare(sql:string){return {bind(...args:any[]){const stmt=db.prepare(sql);return {first:async()=>stmt.get(...args)||null,run:async()=>stmt.run(...args),all:async()=>({results:stmt.all(...args)})};}}}},MEDIA:{get:async(key:string)=>objects.has(key)?{arrayBuffer:async()=>objects.get(key)!.slice().buffer}:null,put:async(key:string,data:Uint8Array)=>{objects.set(key,data);}},JOB_SIGNING_SECRET:"test-only-long-enough-signing-secret",REPLICATE_API_TOKEN:"mock",REPLICATE_MULTI_FACE_SWAP_VERSION:"test"} as unknown as Env;
 // ensureBillingAccount batches the signup grant in production.
 db.prepare("INSERT INTO billing_accounts(user_id,updated_at) VALUES ('u',1)").run();
 db.prepare("INSERT INTO credit_grants(id,user_id,bucket,source,credits,reset_existing,external_ref,created_at) VALUES ('g','u','permanent','signup',10,0,'signup:u',1)").run();
 const parent:Job={id:crypto.randomUUID(),prediction_id:null,status:"processing",style:"multiple-face-swap",attempts:1,created_at:Date.now(),expires_at:Date.now()+7200000,output_key:null,output_type:null,error:null,user_id:"u",tool:"multiple-face-swap",credits_reserved:count*2};
 assert.ok(await reserveCredits(env,{jobId:parent.id,userId:"u",tool:"multiple-face-swap",credits:count*2}));
 db.prepare("INSERT INTO jobs(id,status,style,attempts,created_at,expires_at,user_id,tool,credits_reserved) VALUES (?,'processing','multiple-face-swap',1,?,?,'u','multiple-face-swap',?)").run(parent.id,parent.created_at,parent.expires_at,count*2);
 const children=Array.from({length:count},()=>crypto.randomUUID());const crops=children.map((_,i)=>({x:i*70,y:0,width:50,height:50}));
 children.forEach(id=>{db.prepare("INSERT INTO jobs(id,status,style,attempts,created_at,expires_at,output_key) VALUES (?,'succeeded','face-crop',1,?,?,?)").run(id,parent.created_at,parent.expires_at,`output/${id}`);objects.set(`output/${id}`,encodePng({width:50,height:50,data:new Uint8Array(50*50*4).fill(255)}));});
 objects.set(`input/${parent.id}`,encodePng({width:400,height:100,data:new Uint8Array(400*100*4)}));
 db.prepare("INSERT INTO multiple_face_jobs(job_id,children,crops,composing_at) VALUES (?,?,?,0)").run(parent.id,JSON.stringify(children),JSON.stringify(crops));
 return {db,env,parent,children,objects};
}

test("five independent results compose once and capture ten credits once",async()=>{
 const {db,env,parent,children,objects}=await fixture(5);
 try{
  // Mix a new padded provider result with older in-flight unpadded results.
  const key=`output/${children[0]}`;
  objects.set(key,encodePng(padFaceCrop(decodePng(objects.get(key)!))));
  assert.equal(db.prepare("SELECT permanent_credits FROM billing_accounts").get()?.permanent_credits,0);
  await Promise.all([pollMultiple(env,{...parent},"https://pixform.ai"),pollMultiple(env,{...parent},"https://pixform.ai")]);
  const saved=db.prepare("SELECT * FROM jobs WHERE id=?").get(parent.id) as unknown as Job;
  assert.equal(saved.status,"succeeded");assert.equal(db.prepare("SELECT state FROM credit_reservations").get()?.state,"captured");
  await pollMultiple(env,saved,"https://pixform.ai");
  // A delayed request must not turn a saved result into a failed/refunded one.
  db.prepare("UPDATE jobs SET status='failed' WHERE id=?").run(children[0]);
  await pollMultiple(env,{...parent},"https://pixform.ai");
  assert.equal(db.prepare("SELECT status FROM jobs WHERE id=?").get(parent.id)?.status,"succeeded");
  assert.equal(db.prepare("SELECT state FROM credit_reservations").get()?.state,"captured");
  assert.equal(db.prepare("SELECT count(*) n FROM credit_ledger WHERE reason='generation_reserve'").get()?.n,1);
  const result=decodePng(objects.get(`output/${parent.id}`)!);assert.equal(result.data[(80*400+390)*4],0);assert.equal(result.data[(25*400+25)*4],255);
 }finally{db.close();}
});

test("any failed face releases the whole six-credit reservation exactly once",async()=>{
 const {db,env,parent,children,objects}=await fixture(3);
 try{
  db.prepare("UPDATE jobs SET status='failed' WHERE id=?").run(children[1]);
  await Promise.all([pollMultiple(env,{...parent},"https://pixform.ai"),pollMultiple(env,{...parent},"https://pixform.ai")]);
  assert.equal(db.prepare("SELECT permanent_credits FROM billing_accounts").get()?.permanent_credits,10);
  assert.equal(db.prepare("SELECT count(*) n FROM credit_ledger WHERE reason='generation_release'").get()?.n,1);
  assert.equal(objects.has(`output/${parent.id}`),false);
 }finally{db.close();}
});

test("concurrent polls start each independent crop only once",async()=>{
 const {db,env,parent,children}=await fixture(1);const original=globalThis.fetch;let calls=0;
 try{
  db.prepare("UPDATE jobs SET status='pending',output_key=NULL WHERE id=?").run(children[0]);
  globalThis.fetch=async()=>{calls++;return Response.json({id:"mock-prediction",status:"starting"});};
  await Promise.all([pollMultiple(env,{...parent},"https://pixform.ai"),pollMultiple(env,{...parent},"https://pixform.ai")]);
  assert.equal(calls,1);assert.equal(db.prepare("SELECT prediction_id FROM jobs WHERE id=?").get(children[0])?.prediction_id,"mock-prediction");
 }finally{globalThis.fetch=original;db.close();}
});
