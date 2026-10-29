import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pendingCheckoutAction, type PendingCheckout } from "../lib/billing/checkout.ts";

function fixture(){const db=new DatabaseSync(":memory:");for(const file of ["0001_initial.sql","0002_daily_metrics.sql","0003_auth_billing.sql","0004_billing_safety.sql"])db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),"utf8"));db.prepare("INSERT INTO billing_accounts(user_id,updated_at) VALUES ('u1',1)").run();return db;}
function grant(db:DatabaseSync,id:string,credits:number,bucket="permanent",reset=0){db.prepare("INSERT INTO credit_grants(id,user_id,bucket,source,credits,reset_existing,external_ref,created_at) VALUES (?, 'u1',?,'test',?,?,?,1)").run(id,bucket,credits,reset,`ref:${id}`);}

test("credit grants are idempotent and ledger-backed",()=>{const db=fixture();grant(db,"g1",10);assert.equal(db.prepare("SELECT permanent_credits FROM billing_accounts WHERE user_id='u1'").get()?.permanent_credits,10);assert.throws(()=>grant(db,"g1",10));assert.equal(db.prepare("SELECT count(*) count FROM credit_ledger").get()?.count,1);db.close();});

test("reservations cannot overspend and release exactly once",()=>{const db=fixture();grant(db,"g1",3);const reserve=db.prepare("INSERT INTO credit_reservations(job_id,user_id,tool,credits,subscription_used,permanent_used,state,created_at) VALUES (?,'u1','face-swap',2,0,2,'reserved',2)");reserve.run("j1");assert.throws(()=>reserve.run("j2"));assert.equal(db.prepare("SELECT permanent_credits FROM billing_accounts WHERE user_id='u1'").get()?.permanent_credits,1);db.prepare("UPDATE credit_reservations SET state='released',resolved_at=3 WHERE job_id='j1' AND state='reserved'").run();db.prepare("UPDATE credit_reservations SET state='released',resolved_at=4 WHERE job_id='j1' AND state='reserved'").run();assert.equal(db.prepare("SELECT permanent_credits FROM billing_accounts WHERE user_id='u1'").get()?.permanent_credits,3);assert.equal(db.prepare("SELECT count(*) count FROM credit_ledger WHERE reason='generation_release'").get()?.count,1);db.close();});

test("subscription renewals reset only the subscription bucket",()=>{const db=fixture();grant(db,"pack",5);grant(db,"month1",300,"subscription",1);db.prepare("INSERT INTO credit_reservations(job_id,user_id,tool,credits,subscription_used,permanent_used,state,created_at) VALUES ('j1','u1','image-to-image',1,1,0,'reserved',2)").run();grant(db,"month2",300,"subscription",1);const b=db.prepare("SELECT subscription_credits,permanent_credits FROM billing_accounts WHERE user_id='u1'").get();assert.equal(b?.subscription_credits,300);assert.equal(b?.permanent_credits,5);db.close();});

test("subscription checkout reuses the same offer and expires a different open offer",()=>{
  const pending:PendingCheckout={id:"o1",offerKey:"pro_monthly_v1",sessionId:"cs_1",createdAt:1};
  const open={status:"open" as const,url:"https://checkout.stripe.test/c/pay/cs_1"};
  assert.equal(pendingCheckoutAction(pending,open,"pro_monthly_v1",10),"reuse");
  assert.equal(pendingCheckoutAction(pending,open,"pro_yearly_v1",10),"expire");
});

test("subscription checkout handles incomplete and terminal sessions safely",()=>{
  const preparing:PendingCheckout={id:"o1",offerKey:"pro_monthly_v1",sessionId:null,createdAt:1_000};
  assert.equal(pendingCheckoutAction(preparing,null,"pro_yearly_v1",2_000),"wait");
  assert.equal(pendingCheckoutAction(preparing,null,"pro_yearly_v1",400_001),"expire");
  const existing={...preparing,sessionId:"cs_1"};
  assert.equal(pendingCheckoutAction(existing,{status:"complete",url:null},"pro_yearly_v1",2_000),"confirming");
  assert.equal(pendingCheckoutAction(existing,{status:"expired",url:null},"pro_yearly_v1",2_000),"create");
});
