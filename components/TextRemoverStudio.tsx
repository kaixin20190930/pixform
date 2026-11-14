"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type JobView = { token?: string; status: string; output?: string; error?: string };
export default function TextRemoverStudio({ preview = true }: { preview?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const [file,setFile] = useState<File|null>(null), [original,setOriginal] = useState("");
  const [credits,setCredits] = useState<number|null>(null), [status,setStatus] = useState("idle"), [error,setError] = useState("");
  const [result,setResult] = useState(""), [token,setToken] = useState("");
  const input = useRef<HTMLInputElement>(null), active = useRef(false), requestId = useRef("");
  const mounted = useRef(true);
  const canvasRef=useRef<HTMLCanvasElement>(null), base=useRef<HTMLCanvasElement|null>(null);
  const strokes=useRef<{x:number;y:number;size:number}[][]>([]),drawing=useRef(false);
  const [brush,setBrush]=useState(24),[marked,setMarked]=useState(false),[dimensions,setDimensions]=useState("");
  function redraw(){const canvas=canvasRef.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx||!base.current)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base.current,0,0);ctx.strokeStyle="rgba(230,70,90,.55)";ctx.fillStyle="rgba(230,70,90,.55)";ctx.lineCap="round";ctx.lineJoin="round";for(const stroke of strokes.current){for(let i=0;i<stroke.length;i++){const p=stroke[i];ctx.lineWidth=p.size;ctx.beginPath();if(i){ctx.moveTo(stroke[i-1].x,stroke[i-1].y);ctx.lineTo(p.x,p.y);ctx.stroke();}else{ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fill();}}}setMarked(strokes.current.length>0);}
  useEffect(()=>{if(!file)return;let cancelled=false;createImageBitmap(file).then(image=>{if(cancelled){image.close();return;}const scale=Math.min(1,1024/Math.max(image.width,image.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext("2d")!;ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);image.close();base.current=c;strokes.current=[];if(canvasRef.current){canvasRef.current.width=c.width;canvasRef.current.height=c.height;}setDimensions(`${c.width} × ${c.height}`);redraw();}).catch(()=>setError("This photo could not be opened."));return()=>{cancelled=true;};},[file]);
  function point(e:React.PointerEvent<HTMLCanvasElement>){const c=e.currentTarget,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height,size:brush*c.width/r.width};}
  function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){if(busy||!!token&&!result)return;e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;strokes.current.push([point(e)]);redraw();}
  function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;strokes.current.at(-1)!.push(point(e));redraw();}
  async function blob(c:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Cannot prepare image")),"image/png"));}

  const busy = ["uploading","starting","processing"].includes(status);
  useEffect(() => { try { const saved=sessionStorage.getItem("pixform:text-remover:request"); if(saved){const value=JSON.parse(saved);if(typeof value.token==="string"){setToken(value.token);setStatus("paused");}} } catch {} },[]);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; },[]);
  useEffect(() => { if (!file) {setOriginal("");return;} const url=URL.createObjectURL(file);setOriginal(url);return()=>URL.revokeObjectURL(url); },[file]);
  useEffect(() => { if (!session) {setCredits(null);return;} const load=()=>fetch("/api/account/credits",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(v)setCredits(v.total);}).catch(()=>{});load();window.addEventListener("pixform:credits",load);return()=>window.removeEventListener("pixform:credits",load); },[session]);
  function select(next?:File) {
    if (!next || active.current) return;
    if (!next.size || next.size>10*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(next.type)) {setError("Choose a JPG, PNG or WebP photo under 10 MB.");return;}
    sessionStorage.removeItem("pixform:text-remover:request");setFile(next);setResult("");setToken("");setStatus("idle");setError("");requestId.current="";
  }
  async function normalized(){if(!base.current||!marked)throw new Error("Brush over the text first.");return blob(base.current);}
  async function maskBlob(){const c=document.createElement("canvas");c.width=base.current!.width;c.height=base.current!.height;const ctx=c.getContext("2d")!;ctx.fillStyle="#000";ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle="#fff";ctx.fillStyle="#fff";ctx.lineCap="round";ctx.lineJoin="round";for(const stroke of strokes.current)for(let i=0;i<stroke.length;i++){const p=stroke[i];ctx.lineWidth=p.size;ctx.beginPath();if(i){ctx.moveTo(stroke[i-1].x,stroke[i-1].y);ctx.lineTo(p.x,p.y);ctx.stroke();}else{ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fill();}}const pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){const v=pixels.data[i]>=128?255:0;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}ctx.putImageData(pixels,0,0);return blob(c);}
  async function generate() {
    if ((!file && !token) || active.current || isPending) return;
    if (!session) {await authClient.signIn.social({provider:"google",callbackURL:window.location.href});return;}
    if (!token && credits !== null && credits<1) {setError("You need 1 credit to remove text.");return;}
    active.current=true;setStatus("uploading");setError("");
    try {
      let access=token;
      let job:JobView={status:"processing"};
      if (!access) {
        requestId.current ||= crypto.randomUUID();
        const body=new FormData();body.set("image",await normalized(),"photo.png");body.set("requestId",requestId.current);body.set("mask",await maskBlob(),"mask.png");
        const response=await fetch("/api/photo-to-text-remover-page",{method:"POST",body});job=await response.json();
        if (!response.ok) {if([400,401,402,403,413].includes(response.status))requestId.current="";throw new Error(job.error || "We couldn't start. Check this request again.");}
        access=job.token || "";if(!access)throw new Error("We couldn't confirm your request.");setToken(access);sessionStorage.setItem("pixform:text-remover:request",JSON.stringify({token:access}));
      }
      for(let i=0;i<180;i++) {
        if(!mounted.current)return;
        setStatus(job.status);
        if(job.status==="succeeded"&&job.output){setResult(job.output);window.dispatchEvent(new Event("pixform:credits"));return;}
        if(job.status==="failed"){sessionStorage.removeItem("pixform:text-remover:request");setToken("");requestId.current="";throw new Error(job.error || "Generation failed. Reserved credits were returned.");}
        await new Promise(resolve=>setTimeout(resolve,2000));
        const response=await fetch("/api/jobs",{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
        const update=await response.json();
        if(!response.ok) {if(response.status===404){sessionStorage.removeItem("pixform:text-remover:request");setToken("");requestId.current="";}throw new Error(update.error || "We couldn't check the request. Check it again shortly.");}
        job=update;
      }
      throw new Error("The model is taking longer than expected. Use Check request to continue without starting another generation.");
    } catch(e) {if(mounted.current){setStatus("paused");setError(e instanceof Error?e.message:"Check this request again shortly.");}} finally {active.current=false;window.dispatchEvent(new Event("pixform:credits"));}
  }
  async function download() {
    try { const response=await fetch("/api/download",{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error();const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="pixform-text-remover-page.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); } catch {setError("The download is unavailable or expired.");}
  }
  function another() {sessionStorage.removeItem("pixform:text-remover:request");setFile(null);if(input.current)input.current.value="";base.current=null;strokes.current=[];setMarked(false);setResult("");setToken("");requestId.current="";setStatus("idle");setError("");}
  return <div className="studio face-studio" id="text-remover-studio" aria-label="Text removal studio"><div className="studio-top"><span><i/> BRUSH OVER TEXT. KEEP THE REST.</span><span>{preview ? "ISOLATED PREVIEW" : "REMOVE TEXT FROM IMAGE"}</span></div><div className="face-workspace">
    <div className="face-inputs"><p className="control-label">Your photo</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label="Upload photo" disabled={busy||!!token&&!result} onChange={e=>select(e.target.files?.[0])}/>{file?<><canvas ref={canvasRef} aria-label="Brush over text to remove" style={{width:"100%",height:"auto",touchAction:"none",cursor:"crosshair",display:"block",border:"1px solid #ccc"}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/><label>Brush size <input type="range" min="6" max="80" value={brush} disabled={busy||!!token} onChange={e=>setBrush(Number(e.target.value))}/></label><div className="result-actions"><button disabled={busy||!!token} onClick={()=>{strokes.current.pop();redraw();}}>Undo stroke</button><button disabled={busy||!!token} onClick={()=>{strokes.current=[];redraw();}}>Clear mask</button><button disabled={busy||!!token} onClick={()=>input.current?.click()}>Replace photo</button></div><p className="slot-hint">Prepared image: {dimensions}. Longest side up to 1024 pixels. Brush slightly beyond each letter.</p></>:<button type="button" className="upload" onClick={()=>input.current?.click()}><strong>Upload an image</strong><small>JPG / PNG / WEBP · up to 10 MB</small></button>}
    <p className="slot-hint">Best for solid walls, flat colors and gentle gradients. Text over faces, fine textures and busy backgrounds can leave visible patches.</p>
    <button className="generate" disabled={(!file&&!token)||(!marked&&!token)||busy||isPending||!!result||!!session&&credits!==null&&credits<1&&!token} onClick={generate}>{busy?"Removing text…":token?"Check request":!session?"Sign in to remove text · 1 credit":"Generate text-remover page · 1 credit"}</button>
    <p className="availability">1 credit per edit{credits!==null?` · ${credits} available`:" · 10 welcome credits with Google sign-in"}. <Link href="/pricing">See pricing</Link></p>
    </div><div className="result-panel face-result"><div className="result-heading"><span>Your edited image</span><span className="live-label">{result?"RESULT":"PREVIEW"}</span></div><div className={`result-canvas ${result?"complete":""}`}>{result?<img src={result} alt="Edited image" width={1024} height={1024}/>:busy?<div className="waiting" role="status"><span className="spinner" aria-hidden/><p>{status==="uploading"?"Preparing your photo":"Removing selected text"}</p><progress aria-label="Generating text-remover page"/><small>Processing times vary. A checked request does not start another generation.</small></div>:<div className="empty-result"><p>Your image.<br/><em>Without the text.</em></p><small>Brush over the letters you want to remove.</small></div>}</div><div className="result-actions">{result?<><button className="dark-button" onClick={download}>Download PNG ↓</button><button onClick={()=>{sessionStorage.removeItem("pixform:text-remover:request");setResult("");setToken("");requestId.current="";setStatus("idle");}}>Edit mask · next edit costs 1 credit</button><button onClick={another}>Use another photo</button></>:<span>PNG download · Temporary storage</span>}</div></div></div>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
