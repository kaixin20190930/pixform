import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TextRemoverStudio from "@/components/TextRemoverStudio";
import { environment } from "@/lib/cloudflare";
import { textRemoverEnabled } from "@/lib/text-remover-config";
import { textTitle as title,textDescription as description,textFaqs } from "@/lib/text-remover-content";
export const dynamic="force-dynamic";
export const metadata:Metadata={title,description,robots:{index:false,follow:false}};
export default async function TextRemoverPage(){
 if(!textRemoverEnabled(await environment()))notFound();
 const schema={"@context":"https://schema.org","@type":"FAQPage",mainEntity:textFaqs.map(([name,text])=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}))};
 return <main id="main"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/><section className="hero wrap face-hero"><div className="section-label">ISOLATED PREVIEW · 1 CREDIT PER EDIT</div><h1>Remove Text From Image</h1><TextRemoverStudio/></section>
 <section className="steps wrap"><h2>How to remove text from an image</h2><div className="three-grid">{[["Upload","Choose a JPG, PNG or WebP under 10 MB."],["Brush","Paint over the letters, including a small margin. Review your selection."],["Download","Spend 1 credit, inspect the result and save a PNG."]].map(([h,p])=><article key={h}><h3>{h}</h3><p>{p}</p></article>)}</div></section>
 <section className="explain wrap"><h2>Start with simple backgrounds</h2><div className="prose"><p>Try a label on a plain wall, a caption over a flat color or lettering against a gentle sky gradient. Paint over each letter completely. Undo or clear the mask if you select too much.</p><p>This text remover from image fills selected regions with plausible background. It cannot recover hidden details. Grass, wood grain, fine lines, text near faces and large areas may look blurred or patched. Review every result. This is not a dependable method for redacting sensitive information.</p><p>Images are prepared at up to 1024 pixels on the longest side, with transparency flattened onto white. Only the masked region is changed relative to that prepared image.</p></div></section>
 <section className="explain wrap"><h2>Credits and downloads</h2><div className="prose"><p>One successful edit costs 1 credit. Select several text areas in one job for the same price. New accounts receive 10 welcome credits with Google sign-in. See <Link href="/pricing">pricing</Link> for the shared credit balance.</p><p>Credits are reserved when you start and captured after the result is saved. System failures return the reservation. Editing the mask and generating again costs another credit. Repeated downloads are free.</p><p>Download the PNG within one hour of completion. Unfinished jobs expire two hours after creation. Scheduled cleanup removes expired uploads, masks and results. Only upload images you have permission to edit.</p></div></section>
 <section className="faq wrap"><div><h2>Text removal questions</h2></div><div>{textFaqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{a}</p></details>)}</div></section><section className="related-tools wrap"><Link href="/">Pixform</Link></section></main>;
}
