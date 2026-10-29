import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { environment, billingReady } from "@/lib/cloudflare";
import { currentSession } from "@/lib/session";
import { balance } from "@/lib/billing/credits";
import { PortalButton } from "@/components/BillingAction";
import { SignInButton } from "@/components/BillingAction";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Your Account | Pixform",robots:{index:false,follow:false}};
export default async function Account(){const env=await environment();if(!billingReady(env))return <main id="main" className="legal wrap"><h1>Account setup is in progress.</h1></main>;const session=await currentSession(env,await headers());if(!session)return <main id="main" className="legal wrap"><h1>Sign in to view your account.</h1><SignInButton/></main>;const b=await balance(env,session.user.id);const total=(b?.subscription_credits||0)+(b?.permanent_credits||0);const ledger=await env.DB.prepare("SELECT delta,reason,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(session.user.id).all<{delta:number;reason:string;created_at:number}>();return <main id="main" className="account-page wrap"><div className="section-label">YOUR PIXFORM ACCOUNT</div><h1>{session.user.name}</h1><div className="balance-card"><span>Available credits</span><strong>{total}</strong><p>{b?.subscription_credits||0} subscription · {b?.permanent_credits||0} permanent</p></div><div className="account-actions"><Link className="dark-button" href="/pricing">Add credits</Link>{b?.stripe_customer_id&&<PortalButton/>}</div><h2>Recent credit activity</h2><div className="ledger">{ledger.results.map((row,i)=><div key={`${row.created_at}-${i}`}><span>{row.reason.replaceAll("_"," ")}</span><strong className={row.delta>0?"positive":""}>{row.delta>0?"+":""}{row.delta}</strong><time>{new Date(row.created_at).toLocaleDateString("en-US")}</time></div>)}</div></main>}
