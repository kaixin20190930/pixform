import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,decode} from 'fast-png';
import {textImages,mergeTextResult} from '../lib/text-remover-image.ts';
import {textRemoverEnabled} from '../lib/text-remover-config.ts';
import type {Env} from '../lib/cloudflare.ts';
const png=(data:Uint8Array,channels=3)=>encode({width:4,height:4,depth:8,channels,data});
test('text removal rejects empty, whole-image and mismatched masks; preserves every unselected pixel',()=>{
 const original=new Uint8Array(48).fill(100),mask=new Uint8Array(48);mask.fill(255,3,6);const out=new Uint8Array(48).fill(200);
 const result=decode(mergeTextResult(png(original),png(mask),png(out)));
 assert.deepEqual([...result.data],[100,100,100,200,200,200,...original.slice(6)]);
 assert.throws(()=>textImages(png(original),png(new Uint8Array(48))));
 assert.throws(()=>textImages(png(original),png(new Uint8Array(48).fill(255))));
 const rgba=new Uint8Array(64).fill(255);assert.doesNotThrow(()=>textImages(png(rgba,4),png(mask)));
 rgba[3]=0;assert.throws(()=>textImages(png(rgba,4),png(mask)));
 assert.throws(()=>mergeTextResult(png(original),png(mask),new Uint8Array()));
});
test('text remover is restricted to its own preview environment',()=>{
 const env={TEXT_REMOVER_PREVIEW_ENABLED:'true',APP_ORIGIN:'https://pixform-text-preview.liukai19911010.workers.dev',BILLING_ENABLED:'true',DB:{},MEDIA:{},REPLICATE_API_TOKEN:'test',JOB_SIGNING_SECRET:'x'.repeat(64)} as Env;
 assert.equal(textRemoverEnabled(env),true);
 assert.equal(textRemoverEnabled({...env,APP_ORIGIN:'https://pixform.ai'}),false);
 assert.equal(textRemoverEnabled({...env,TEXT_REMOVER_PREVIEW_ENABLED:undefined}),false);
});

import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {startTextRemover,pollTextRemover} from '../lib/text-remover-jobs.ts';
import {sweep} from '../lib/cleanup.ts';
import type {Job} from '../lib/jobs.ts';
function fixture() {
  const db=new DatabaseSync(":memory:");
  for (const name of ["0001_initial.sql","0002_daily_metrics.sql","0003_auth_billing.sql","0004_billing_safety.sql","0005_multiple_face_swap.sql"]) db.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  function prepare(sql:string) {
    let args:unknown[]=[];
    return {bind(...values:unknown[]){args=values;return this;},async first(){return db.prepare(sql).get(...args as never[])||null;},async all(){return {results:db.prepare(sql).all(...args as never[])};},async run(){return db.prepare(sql).run(...args as never[]);}};
  }
  const objects=new Map<string,Uint8Array>();
  const env={DB:{prepare,async batch(statements:{run:()=>unknown}[]){return Promise.all(statements.map(s=>s.run()));}},MEDIA:{async put(key:string,value:Uint8Array){objects.set(key,value);},async delete(keys:string[]){keys.forEach(key=>objects.delete(key));}},REPLICATE_API_TOKEN:"test",JOB_SIGNING_SECRET:"p".repeat(64),TEXT_REMOVER_PREVIEW_ENABLED:"true",BILLING_ENABLED:"true",APP_ORIGIN:"https://pixform-text-preview.liukai19911010.workers.dev"} as unknown as Env;
  const balance=()=>Number(db.prepare("SELECT permanent_credits FROM billing_accounts WHERE user_id='test-user'").get()?.permanent_credits || 0);
  const getJob=(id:string)=>db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as Job;
  const image=encode({width:256,height:256,depth:8,channels:3,data:new Uint8Array(256*256*3).fill(100)});
  function request(id:string){const form=new FormData();const mask=new Uint8Array(256*256*3);mask.fill(255,300,600);form.set("mask",new Blob([new Uint8Array(encode({width:256,height:256,channels:3,depth:8,data:mask}))],{type:"image/png"}),"mask.png");form.set("requestId",id);form.set("image",new Blob([new Uint8Array(image)],{type:"image/png"}),"photo.png");return new Request("https://pixform-text-preview.liukai19911010.workers.dev/api/text-remover",{method:"POST",headers:{"cf-connecting-ip":"127.0.0.1",origin:"https://pixform-text-preview.liukai19911010.workers.dev"},body:form});}
  return {env,db,objects,balance,getJob,request};
}
test('text jobs reserve once and release model failures, uncertain POST and expiry without retries',async()=>{
 const f=fixture(),original=globalThis.fetch;let submits=0;
 globalThis.fetch=async(_url,init)=>{if(init?.method==='POST'){submits++;return Response.json({id:'prediction'});}return Response.json({status:'failed'});};
 try{
 const id=crypto.randomUUID();await startTextRemover(f.env,f.request(id),'test-user');await startTextRemover(f.env,f.request(id),'test-user');assert.equal(f.balance(),9);assert.equal(submits,1);await pollTextRemover(f.env,f.getJob(id));await pollTextRemover(f.env,f.getJob(id));assert.equal(f.balance(),10);
 globalThis.fetch=async()=>{submits++;throw new Error('unknown POST outcome');};const uncertain=crypto.randomUUID();await startTextRemover(f.env,f.request(uncertain),'test-user');await startTextRemover(f.env,f.request(uncertain),'test-user');assert.equal(submits,2);assert.equal(f.balance(),10);
 globalThis.fetch=async()=>Response.json({id:'expiry'});const expired=crypto.randomUUID();await startTextRemover(f.env,f.request(expired),'test-user');f.db.prepare('UPDATE jobs SET expires_at=0 WHERE id=?').run(expired);await sweep(f.env);await sweep(f.env);assert.equal(f.balance(),10);
 }finally{globalThis.fetch=original;f.db.close();}
});
