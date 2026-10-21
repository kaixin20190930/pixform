import type { Metadata } from "next";
import Link from "next/link";
import FaceSwapStudio from "@/components/FaceSwapStudio";
import { environment, ready } from "@/lib/cloudflare";
import { faceTitle as title, faceDescription as description, faceFaqs } from "@/lib/face-content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/face-swap", languages: { "en-US": "/face-swap" } },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: "/face-swap", images: [{ url: "/face-swap/opengraph-image", width: 1200, height: 630, alt: "AI Face Swap · Pixform" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/face-swap/opengraph-image"] },
};
export default async function FaceSwap() {
  let enabled = false; try { enabled = ready(await environment(), true); } catch { /* Local preview. */ }
  const schema = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: "Pixform AI Face Swap", url: "https://pixform.ai/face-swap", applicationCategory: "MultimediaApplication", operatingSystem: "Web", ...(enabled ? { offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } } : {}) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faceFaqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://pixform.ai/" }, { "@type": "ListItem", position: 2, name: "Face Swap", item: "https://pixform.ai/face-swap" }] },
  ];
  return <main id="main">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <section className="hero wrap face-hero"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden>›</span><span aria-current="page">Face Swap</span></nav>
      <h1>AI Face Swap</h1><p className="subtitle">Two photos. A new look. Swap faces online, no signup.</p>
      <FaceSwapStudio enabled={enabled} />
    </section>
    <section className="steps wrap" aria-labelledby="face-how"><div className="section-label">HOW IT WORKS</div><h2 id="face-how">Four steps to swap faces.</h2><div className="four-grid">{[
      ["01", "Upload your source photo", "Choose the photo with the body, lighting and scene you want to keep."],
      ["02", "Upload the face to swap in", "Use a clear, front-facing portrait with one visible face."],
      ["03", "Select Swap Faces", "The AI detects and aligns the faces. Follow the status while it processes your photos."],
      ["04", "Download your photo", "Save the result without an added watermark, or try another photo within your hourly allowance."],
    ].map(([n,h,p]) => <article key={n}><span className="step-number">{n}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>
    <section className="explain wrap"><div><div className="section-label">A NEW FACE. YOUR CHOSEN SCENE.</div><h2>What is AI face swap?</h2><span className="big-spark" aria-hidden>✳</span></div><div className="prose">
      <p>AI face swap uses a face in one photograph as a reference for replacing a face in another. The source photo provides the body, background and overall composition you want to keep. The second portrait supplies the face you want to swap in. A face swapper detects facial features, aligns the reference and blends the result into the scene.</p>
      <p>Pixform brings these steps together in a free online face swapper. Upload two photos, confirm that you have permission to use them and choose Swap Faces. Both selected photos stay visible while the result appears beside them. You can compare the new image, download it or start again without moving to a separate results page.</p>
      <p>For a useful starting point, choose one person in each photo. Front-facing portraits with similar angles and even lighting usually give the model more information than small, blurry or obscured faces. Glasses, hands, extreme expressions and dramatic shadows can make blending harder. Results vary: check facial details and the surrounding image before sharing.</p>
      <p>You can swap faces online from a desktop, tablet or phone without installing an app. Free face swap access has a shared hourly allowance, and processing may take longer when the model starts up. This release works with still images. Face swap GIFs, video face swaps and selectable multiple-face editing are separate capabilities described below; they are not available in this tool yet. Use edits with permission and make their synthetic nature clear when context could be misleading.</p>
    </div></section>
    <section className="styles-section wrap"><div className="section-label">CAPABILITIES & ROADMAP</div><h2>More ways to swap faces.</h2><div className="four-grid feature-grid">{[
      ["Face Swap GIF", "Not available", "Animated face swap GIF input and export are not supported. You can download a still photo today."],
      ["Multiple Face Swap", "Not available", "AI multiple face swap with individual face selection is planned for evaluation. Use one person per photo now."],
      ["Gender Face Swap", "Photo swaps only", "Try a different presentation using a portrait you have permission to use. This swaps a face; it does not infer or change anyone’s gender identity."],
      ["Video Face Swap", "Coming soon", "Video face swap is on the roadmap. You cannot swap faces in video or use realtime face swap in this release."],
    ].map(([h,b,p]) => <article key={h}><span className="live-label">{b}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>
    <section className="faq wrap"><div><div className="section-label">A FEW THINGS TO KNOW</div><h2>Face swap questions.</h2></div><div>{faceFaqs.map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="related-tools wrap"><div className="section-label">RELATED TOOLS</div><h2>Keep experimenting.</h2><Link className="related-card" href="/"><h3>Image to Image AI <span aria-hidden>↗</span></h3><p>Transform your photos with six artistic styles.</p></Link><p className="slot-hint">More AI image tools coming soon.</p></section>
  </main>;
}
