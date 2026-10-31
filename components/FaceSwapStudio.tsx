"use client";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

function PhotoSlot({ label, hint, file, onSelect, busy }: { label: string; hint: string; file: File | null; onSelect: (file?: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  useEffect(() => { if (!file) { setUrl(""); if (input.current) input.current.value = ""; return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return <div className="face-slot"><p className="control-label">{label}</p><p className="slot-hint">{hint}</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label={label} disabled={busy} onChange={e => onSelect(e.target.files?.[0])} />
    <button type="button" aria-label={`Choose ${label.toLowerCase()}`} className={`upload ${drag ? "dragging" : ""}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); onSelect(e.dataTransfer.files[0]); }}>
      {url ? <><img src={url} alt={label} width={300} height={180} /><span className="replace">Replace photo</span></> : <><span className="upload-icon" aria-hidden>↥</span><strong>Click or drag here</strong><small>JPG / PNG / WEBP · up to 10 MB</small></>}
    </button>
  </div>;
}
export default function FaceSwapStudio({ enabled, billingEnabled }: { enabled: boolean; billingEnabled: boolean }) {
  const {data:session}=authClient.useSession(); const [credits,setCredits]=useState<number|null>(null);
  const [source, setSource] = useState<File | null>(null), [face, setFace] = useState<File | null>(null);
  const [consent, setConsent] = useState(false), [status, setStatus] = useState("idle"), [error, setError] = useState("");
  const [result, setResult] = useState(""), [token, setToken] = useState(""), [seconds, setSeconds] = useState(0);
  const runId = useRef(0); const busy = ["uploading", "starting", "processing"].includes(status);
  useEffect(() => () => { runId.current++; }, []);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setSeconds(n => n + 1), 1000); return () => clearInterval(t); }, [busy]);
  useEffect(()=>{if(!billingEnabled||!session)return;const load=()=>fetch("/api/account/credits",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>v&&setCredits(v.total));load();window.addEventListener("pixform:credits",load);return()=>window.removeEventListener("pixform:credits",load);},[billingEnabled,session]);
  function select(file: File | undefined, target: "source" | "face") {
    if (!file || busy) return;
    if (!file.size || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WEBP image under 10 MB for each photo."); return; }
    (target === "source" ? setSource : setFace)(file); setResult(""); setToken(""); setStatus("idle"); setError("");
  }
  async function swap() {
    if (!source || !face || !consent || busy || !enabled) return;
    if(billingEnabled&&!session){await authClient.signIn.social({provider:"google",callbackURL:window.location.href});return;}
    const run = ++runId.current; setStatus("uploading"); setResult(""); setError(""); setSeconds(0);
    try {
      const body = new FormData(); body.set("image", source); body.set("face", face); body.set("consent", "true");
      const r = await fetch("/api/face-swap", { method: "POST", body }); const initial = await r.json();
      if (!r.ok) throw new Error(initial.error || "We couldn't start your face swap.");
      const access = initial.token; setToken(access); let job = initial;
      for (let i = 0; i < 180; i++) {
        if (run !== runId.current) return;
        setStatus(job.status);
        if (job.status === "succeeded" && job.output) { setResult(job.output); window.dispatchEvent(new Event("pixform:credits")); return; }
        if (["failed", "canceled"].includes(job.status)) throw new Error("We couldn't swap these faces. Try clear, front-facing photos with one face in each.");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const update = await fetch("/api/jobs", { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" });
        if (!update.ok) throw new Error("We couldn't check your result. Your selected photos are still here.");
        job = await update.json();
      }
      throw new Error("This swap is taking longer than expected. Your photos are still selected; please try again later.");
    } catch (e) { if (run !== runId.current) return; setStatus("failed"); setError(e instanceof Error ? e.message : "Please try again later."); }
  }
  async function download() {
    try {
      const r = await fetch("/api/download", { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error();
      const blob = await r.blob(); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u;
      a.download = `pixform-face-swap.${blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png"}`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch { setError("This download has expired or is unavailable. Please create a new swap."); }
  }
  return <div className="studio face-studio" id="face-studio" aria-label="Face swap studio">
    <div className="studio-top"><span><i /> TWO PHOTOS. ONE NEW LOOK.</span><span>02 / FACE SWAP</span></div>
    <div className="face-workspace"><div className="face-inputs">
      <div className="face-uploads"><PhotoSlot label="Source photo" hint="The body and scene to keep" file={source} onSelect={f => select(f, "source")} busy={busy} /><PhotoSlot label="Face to swap in" hint="A clear, front-facing portrait" file={face} onSelect={f => select(f, "face")} busy={busy} /></div>
      <label className="face-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />I have permission to use both photos and the people depicted.</label>
      <button className="generate" disabled={!source || !face || !consent || busy || !enabled} onClick={swap}>{busy ? "Swapping faces…" : billingEnabled&&!session?"Sign in to swap faces":"Swap Faces"}</button>
      <p className="availability">{billingEnabled?`2 credits per swap${credits===null?"":` · ${credits} available`}`:enabled ? "Limited preview access" : "Face swapping is being prepared. Please check back soon."}</p>
    </div><div className="result-panel face-result"><div className="result-heading"><span>Your face swap</span><span className="live-label">{result ? "RESULT" : "PREVIEW"}</span></div>
      <div className={`result-canvas ${result ? "complete" : ""}`}>
        {result ? <img src={result} alt="AI face swap result using your selected scene and face" width={768} height={768} /> : busy ? <div className="waiting" role="status"><span className="spinner" aria-hidden /><p>{status === "uploading" ? "Uploading your photos" : status === "starting" ? "Waiting for the model" : "Blending your new look"}</p><p>{seconds}s elapsed</p><progress aria-label="Swapping faces" /><small>Cold starts can take longer. Keep this tab open.</small></div> : <div className="empty-result"><p>A familiar scene.<br /><em>A different face.</em></p><small>Your result appears here, beside your photos.</small></div>}
      </div><div className="result-actions">{result ? <><button className="dark-button" onClick={download}>Download ↓</button><button onClick={() => { setSource(null); setFace(null); setResult(""); setToken(""); setStatus("idle"); setError(""); setConsent(false); }}>Try another photo</button></> : <span>No added watermark · Private temporary storage</span>}</div>
    </div></div>{error && <p className="error" role="alert">{error}</p>}
  </div>;
}
