"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type JobView = { token?: string; status: string; output?: string; error?: string };
export default function ColoringStudio() {
  const { data: session, isPending } = authClient.useSession();
  const [file,setFile] = useState<File|null>(null), [original,setOriginal] = useState("");
  const [credits,setCredits] = useState<number|null>(null), [status,setStatus] = useState("idle"), [error,setError] = useState("");
  const [result,setResult] = useState(""), [token,setToken] = useState("");
  const input = useRef<HTMLInputElement>(null), active = useRef(false), requestId = useRef("");
  const mounted = useRef(true);
  const busy = ["uploading","starting","processing"].includes(status);
  useEffect(() => { try { const saved=sessionStorage.getItem("pixform:coloring:request"); if(saved){const value=JSON.parse(saved);if(typeof value.token==="string"){setToken(value.token);setStatus("paused");}} } catch {} },[]);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; },[]);
  useEffect(() => { if (!file) {setOriginal("");return;} const url=URL.createObjectURL(file);setOriginal(url);return()=>URL.revokeObjectURL(url); },[file]);
  useEffect(() => { if (!session) {setCredits(null);return;} const load=()=>fetch("/api/account/credits",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(v)setCredits(v.total);}).catch(()=>{});load();window.addEventListener("pixform:credits",load);return()=>window.removeEventListener("pixform:credits",load); },[session]);
  function select(next?:File) {
    if (!next || active.current) return;
    if (!next.size || next.size>10*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(next.type)) {setError("Choose a JPG, PNG or WebP photo under 10 MB.");return;}
    sessionStorage.removeItem("pixform:coloring:request");setFile(next);setResult("");setToken("");setStatus("idle");setError("");requestId.current="";
  }
  async function normalized() {
    // createImageBitmap applies image orientation before drawing. Flatten alpha onto white.
    const image=await createImageBitmap(file!);
    try {
      const scale=Math.min(1,768/Math.max(image.width,image.height));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("This browser cannot prepare the photo.");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Choose a different photo.")),"image/png"));
    } finally { image.close(); }
  }
  async function generate() {
    if ((!file && !token) || active.current || isPending) return;
    if (!session) {await authClient.signIn.social({provider:"google",callbackURL:window.location.href});return;}
    if (!token && credits !== null && credits<2) {setError("You need 2 credits to generate a coloring page.");return;}
    active.current=true;setStatus("uploading");setError("");
    try {
      let access=token;
      let job:JobView={status:"processing"};
      if (!access) {
        requestId.current ||= crypto.randomUUID();
        const body=new FormData();body.set("image",await normalized(),"photo.png");body.set("requestId",requestId.current);
        const response=await fetch("/api/photo-to-coloring-page",{method:"POST",body});job=await response.json();
        if (!response.ok) {if([400,401,402,403,413].includes(response.status))requestId.current="";throw new Error(job.error || "We couldn't start. Check this request again.");}
        access=job.token || "";if(!access)throw new Error("We couldn't confirm your request.");setToken(access);sessionStorage.setItem("pixform:coloring:request",JSON.stringify({token:access}));
      }
      for(let i=0;i<180;i++) {
        if(!mounted.current)return;
        setStatus(job.status);
        if(job.status==="succeeded"&&job.output){setResult(job.output);window.dispatchEvent(new Event("pixform:credits"));return;}
        if(job.status==="failed"){sessionStorage.removeItem("pixform:coloring:request");setToken("");requestId.current="";throw new Error(job.error || "Generation failed. Reserved credits were returned.");}
        await new Promise(resolve=>setTimeout(resolve,2000));
        const response=await fetch("/api/jobs",{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
        const update=await response.json();
        if(!response.ok) {if(response.status===404){sessionStorage.removeItem("pixform:coloring:request");setToken("");requestId.current="";}throw new Error(update.error || "We couldn't check the request. Check it again shortly.");}
        job=update;
      }
      throw new Error("The model is taking longer than expected. Use Check request to continue without starting another generation.");
    } catch(e) {if(mounted.current){setStatus("paused");setError(e instanceof Error?e.message:"Check this request again shortly.");}} finally {active.current=false;window.dispatchEvent(new Event("pixform:credits"));}
  }
  async function download() {
    try { const response=await fetch("/api/download",{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error();const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="pixform-coloring-page.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); } catch {setError("The download is unavailable or expired.");}
  }
  function another() {sessionStorage.removeItem("pixform:coloring:request");setResult("");setToken("");requestId.current="";setStatus("idle");setError("");}
  return <div className="studio face-studio" id="coloring-studio" aria-label="Photo to coloring page studio"><div className="studio-top"><span><i/> BLACK OUTLINES. WHITE PAPER.</span><span>ISOLATED PREVIEW</span></div><div className="face-workspace">
    <div className="face-inputs"><p className="control-label">Your photo</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label="Upload photo" disabled={busy||!!token&&!result} onChange={e=>select(e.target.files?.[0])}/><button type="button" className="upload" disabled={busy||!!token&&!result} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!token||result)select(e.dataTransfer.files[0]);}}>{original?<><img src={original} alt="Original photo" width={768} height={768}/><span className="replace">Replace photo</span></>:<><span className="upload-icon" aria-hidden>↥</span><strong>Click or drag here</strong><small>JPG / PNG / WEBP · up to 10 MB</small></>}</button>
    <p className="slot-hint">Best with clear portraits, pets, and simple scenes. AI may simplify details and backgrounds. Night photos and busy scenes may produce poor results.</p>
    <button className="generate" disabled={(!file&&!token)||busy||isPending||!!result||!!session&&credits!==null&&credits<2&&!token} onClick={generate}>{busy?"Creating outlines…":token?"Check request":!session?"Sign in to generate · 2 credits":"Generate coloring page · 2 credits"}</button>
    <p className="availability">2 credits per image{credits!==null?` · ${credits} available`:" · 10 welcome credits with Google sign-in"}. <Link href="/pricing">See pricing</Link></p>
    </div><div className="result-panel face-result"><div className="result-heading"><span>Your coloring page</span><span className="live-label">{result?"RESULT":"PREVIEW"}</span></div><div className={`result-canvas ${result?"complete":""}`}>{result?<img src={result} alt="Generated black-and-white coloring page" width={768} height={768}/>:busy?<div className="waiting" role="status"><span className="spinner" aria-hidden/><p>{status==="uploading"?"Preparing your photo":"Creating your coloring page"}</p><progress aria-label="Generating coloring page"/><small>Processing times vary. A checked request does not start another generation.</small></div>:<div className="empty-result"><p>Your photo.<br/><em>Ready to color.</em></p><small>Clean black outlines on white.</small></div>}</div><div className="result-actions">{result?<><button className="dark-button" onClick={download}>Download PNG ↓</button><button onClick={another}>Generate again · 2 credits</button></>:<span>PNG download · Temporary storage</span>}</div></div></div>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
