"use client";

import { useEffect, useRef, useState } from "react";
import { styles } from "@/lib/content";
import { authClient } from "@/lib/auth-client";

type Job = { token: string; status: string; output?: string; error?: string };
function event(name: string, properties: Record<string, string | number> = {}) {
  // No filenames, image URLs, photo contents or IPs are sent in event properties.
  window.dispatchEvent(new CustomEvent("pixform:event", { detail: { name, properties } }));
}
export default function Studio({ enabled, billingEnabled, initialStyle }: { enabled: boolean; billingEnabled: boolean; initialStyle: string }) {
  const { data: session } = authClient.useSession();
  const [credits,setCredits]=useState<number|null>(null);
  const [style, setStyle] = useState(initialStyle);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const busy = ["starting", "processing", "uploading"].includes(status);
  useEffect(() => { setStyle(initialStyle); }, [initialStyle]);
  useEffect(() => {
    function syncStyleHash() {
      const match = window.location.hash.match(/^#studio-([a-z-]+)$/);
      if (!match || !styles.some((candidate) => candidate.id === match[1])) return;
      setStyle(match[1]);
      window.requestAnimationFrame(() => document.getElementById("studio")?.scrollIntoView({ block: "start" }));
    }
    syncStyleHash();
    window.addEventListener("hashchange", syncStyleHash);
    return () => window.removeEventListener("hashchange", syncStyleHash);
  }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(()=>{if(!billingEnabled||!session)return;const load=()=>fetch("/api/account/credits",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>v&&setCredits(v.total));load();window.addEventListener("pixform:credits",load);return()=>window.removeEventListener("pixform:credits",load);},[billingEnabled,session]);
  function select(next?: File) {
    if (!next || busy) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Choose a JPG, PNG or WEBP image."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Your image is larger than 10 MB. Choose a smaller image."); return; }
    if (!next.size) { setError("This file is empty. Please choose another image."); return; }
    setFile(next); setResult(""); setToken(""); setStatus("idle");
    event("upload", { format: next.type });
  }
  async function generate() {
    if (!file || busy) return;
    if (!enabled) { setError("Image generation is being prepared. Please check back soon."); return; }
    if (billingEnabled && !session) { await authClient.signIn.social({provider:"google",callbackURL:window.location.href}); return; }
    const run = ++generation.current;
    setError(""); setResult(""); setSeconds(0); setStatus("uploading");
    event("generate", { style });
    try {
      const body = new FormData(); body.set("image", file); body.set("style", style);
      const response = await fetch("/api/generate", { method: "POST", body });
      const initial = await response.json();
      if (!response.ok) throw new Error(initial.error || "We couldn't start this image. Please try again.");
      let job: Job = initial;
      setToken(job.token);
      for (let poll = 0; poll < 120; poll++) {
        if (run !== generation.current) return;
        setStatus(job.status);
        if (job.status === "succeeded" && job.output) {
          setResult(job.output); setStatus("succeeded"); window.dispatchEvent(new Event("pixform:credits")); return;
        }
        if (["failed", "canceled"].includes(job.status)) throw new Error(job.error || "We couldn't create this image. Your original is still here; please try again.");
        await new Promise(r => setTimeout(r, 2000));
        const update = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${job.token}` }, cache: "no-store" });
        if (!update.ok) throw new Error("We couldn't check your result. Please try again later.");
        job = { ...await update.json(), token: job.token };
      }
      throw new Error("This image is taking longer than expected. Your original is still here. Please try again later.");
    } catch (e) {
      if (run !== generation.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong. Your original is still here.");
      setStatus("failed");
    }
  }
  async function download() {
    try {
      const response = await fetch("/api/download", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const ext = response.headers.get("content-type")?.includes("webp") ? "webp" : response.headers.get("content-type")?.includes("jpeg") ? "jpg" : "png";
      const a = document.createElement("a"); a.href = url; a.download = `pixform-${style}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); event("download", { style });
    } catch { setError("This download is unavailable or has expired. Please generate a new image."); }
  }
  return <div className="studio" id="studio" aria-label="Image transformation studio">
    <div className="studio-top"><span><i /> YOUR CREATIVE WORKSPACE</span><span>01 / IMAGE TO IMAGE</span></div>
    <div className="studio-body">
      <div className="controls">
        <div className="control-label"><span>01</span> Start with your photo</div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" id="photo" disabled={busy} onChange={e => select(e.target.files?.[0])} />
        <button className={`upload ${dragging ? "dragging" : ""} ${preview ? "has-photo" : ""}`} type="button" disabled={busy}
          onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files[0]); }}>
          {preview ? <><img src={preview} width={420} height={180} alt="Your selected original" /><span className="replace">↻ Replace photo</span></> : <><span className="upload-icon" aria-hidden>↥</span><strong>Click or drag image here</strong><small>JPG / PNG / WEBP, up to 10 MB</small></>}
        </button>
        <fieldset disabled={busy}><legend className="control-label"><span>02</span> Pick your perspective</legend><div className="style-options">
          {styles.map(s => <button type="button" key={s.id} aria-pressed={style === s.id} onClick={() => setStyle(s.id)} className={style === s.id ? "selected" : ""}><span aria-hidden style={{ background: s.color }}>{s.mark}</span>{s.name}</button>)}
        </div></fieldset>
        <button className="generate" disabled={!file || busy} onClick={generate}>{busy ? "Creating your image…" : billingEnabled&&!session ? "Sign in to generate" : "Generate Image"}{busy&&<span aria-hidden>◌</span>}</button>
        <p className="availability">{billingEnabled ? `1 credit per image${credits===null?"":` · ${credits} available`}` : enabled ? "Limited preview access" : "Preview the studio · Generation opens soon"}</p>
      </div>
      <div className="result-panel">
        <div className="result-heading"><span>Your next perspective</span><span className="live-label">{result ? "AFTER" : "PREVIEW"}</span></div>
        <div className={`result-canvas ${result ? "complete" : ""}`}>
          {result ? <img src={result} alt={`Your photo transformed in ${style} style`} width={768} height={768} /> : busy ?
            <div className="waiting" role="status"><span className="spinner" aria-hidden /><h3>{status === "starting" ? "Waiting for the model" : status === "uploading" ? "Preparing your photo" : "A new perspective is taking shape"}</h3><p>{seconds}s elapsed · Keep this tab open</p><progress aria-label="Generating image" /><small>The model does not report an exact queue position.</small></div> :
            <div className="empty-result"><div className="abstract-art" aria-hidden><span /><span /><span /><i>✳</i></div><p>A familiar photo.<br /><em>An entirely new feeling.</em></p><small>Your generated image will appear here.</small></div>}
        </div>
        <div className="result-actions">
          {result ? <><button className="dark-button" onClick={download}>Download ↓</button><button onClick={() => { event("try_again", { style }); setResult(""); document.querySelector("fieldset button")?.scrollIntoView({ block: "nearest" }); }}>Try another style</button><button onClick={() => { setFile(null); setResult(""); setToken(""); setStatus("idle"); if (input.current) input.current.value = ""; }}>Start over</button></> : <><span>◉ Original stays yours</span><span>Made for a little experimentation</span></>}
        </div>
      </div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
