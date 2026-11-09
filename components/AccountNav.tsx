"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function AccountNav() {
  const pathname=usePathname();
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const { data, isPending } = authClient.useSession();
  useEffect(()=>{fetch("/api/account/credits",{cache:"no-store"}).then(r=>setEnabled(r.status!==503)).catch(()=>setEnabled(false));},[]);
  if (!enabled) return <a className="small-cta" href={pathname==="/face-swap"?"#face-studio":"/#studio"}>Try Pixform</a>;
  if (isPending) return <span className="account-pending" aria-label="Checking account">•••</span>;
  if (data) return <Link className="small-cta" href="/account">{data.user.name?.split(" ")[0] || "Account"}</Link>;
  return <button className="nav-signin" onClick={() => authClient.signIn.social({ provider:"google", callbackURL: window.location.href })}>Sign in</button>;
}
