"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton({ children="Sign in with Google ↗" }: { children?:React.ReactNode }) {
  const {data}=authClient.useSession();
  return <button className="dark-button price-button" onClick={()=>data?window.location.assign("/account"):authClient.signIn.social({provider:"google",callbackURL:window.location.href})}>{data?"View account ↗":children}</button>;
}

export function CheckoutButton({ offerKey, children, disabled=false }: { offerKey:string; children:React.ReactNode; disabled?:boolean }) {
  const { data }=authClient.useSession(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function checkout(){
    if(!data){ await authClient.signIn.social({provider:"google",callbackURL:window.location.href}); return; }
    setBusy(true); setError("");
    try { const r=await fetch("/api/billing/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({offerKey})}); const value=await r.json(); if(!r.ok||!value.url) throw new Error(value.error||"Checkout is unavailable."); window.location.assign(value.url); }
    catch(e){setError(e instanceof Error?e.message:"Checkout is unavailable.");setBusy(false);}
  }
  return <>{<button className="dark-button price-button" disabled={disabled||busy} onClick={checkout}>{busy?"Opening checkout…":children}</button>}{error&&<small className="error">{error}</small>}</>;
}

export function PortalButton(){
  const [busy,setBusy]=useState(false);
  async function open(){setBusy(true);const r=await fetch("/api/billing/portal",{method:"POST"});const v=await r.json();if(r.ok&&v.url)window.location.assign(v.url);else{alert(v.error||"Billing portal is unavailable.");setBusy(false);}}
  return <button className="dark-button" onClick={open} disabled={busy}>{busy?"Opening…":"Manage billing ↗"}</button>;
}
