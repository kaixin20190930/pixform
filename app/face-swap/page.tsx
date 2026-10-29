import type { Metadata } from "next";
import Link from "next/link";
import FaceSwapStudio from "@/components/FaceSwapStudio";
import { billingReady, environment, ready } from "@/lib/cloudflare";
import { faceTitle as title, faceDescription as description, faceFaqs } from "@/lib/face-content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/face-swap", languages: { "en-US": "/face-swap" } },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: "/face-swap", images: [{ url: "/face-swap/opengraph-image", width: 1200, height: 630, alt: "AI Face Swap · Pixform" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/face-swap/opengraph-image"] },
};
export default async function FaceSwap() {
  let enabled = false,billing=false; try { const env=await environment();enabled = ready(env, true);billing=billingReady(env); } catch { /* Local preview. */ }
  const schema = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: "Pixform AI Face Swap", url: "https://pixform.ai/face-swap", applicationCategory: "MultimediaApplication", operatingSystem: "Web", ...(enabled ? { offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } } : {}) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faceFaqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://pixform.ai/" }, { "@type": "ListItem", position: 2, name: "Face Swap", item: "https://pixform.ai/face-swap" }] },
  ];
  return <main id="main">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <section className="hero wrap face-hero"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden>›</span><span aria-current="page">Face Swap</span></nav>
      <h1>AI Face Swap</h1><p className="subtitle">Two photos. A new look. Swap faces online with clear credit costs.</p>
      <FaceSwapStudio enabled={enabled} billingEnabled={billing} />
    </section>
    <section className="steps wrap" aria-labelledby="face-how"><div className="section-label">HOW IT WORKS</div><h2 id="face-how">Four steps to swap faces.</h2><div className="four-grid">{[
      ["01", "Upload your source photo", "Choose the photo with the body, lighting and scene you want to keep."],
      ["02", "Upload the face to swap in", "Use a clear, front-facing portrait with one visible face."],
      ["03", "Select Swap Faces", "The AI detects and aligns the faces. Follow the status while it processes your photos."],
      ["04", "Download your photo", "Save the result without an added watermark, or use your available credits to try another photo."],
    ].map(([n,h,p]) => <article key={n}><span className="step-number">{n}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>
    <section className="explain wrap"><div><div className="section-label">A NEW FACE. YOUR CHOSEN SCENE.</div><h2>What is AI face swap?</h2><span className="big-spark" aria-hidden>✳</span></div><div className="prose">
      <p>AI face swap uses a face in one photograph as a reference for replacing a face in another. The source photo provides the body, background and overall composition you want to keep. The second portrait supplies the face you want to swap in. A face swapper detects facial features, aligns the reference and blends the result into the scene.</p>
      <p>Pixform brings these steps together in a free online face swapper. Upload two photos, confirm that you have permission to use them and choose Swap Faces. Both selected photos stay visible while the result appears beside them. You can compare the new image, download it or start again without moving to a separate results page.</p>
      <p>For a useful starting point, choose one person in each photo. Front-facing portraits with similar angles and even lighting usually give the model more information than small, blurry or obscured faces. Glasses, hands, extreme expressions and dramatic shadows can make blending harder. Results vary: check facial details and the surrounding image before sharing.</p>
      <p>You can swap faces online from a desktop, tablet or phone without installing an app. A face swap uses 2 credits, and a new account receives 10 free credits once. Processing may take longer when the model starts up. This release works with still images. Face swap GIFs, video face swaps and selectable multiple-face editing are separate capabilities described below; they are not available in this tool yet. Use edits with permission and make their synthetic nature clear when context could be misleading.</p>
    </div></section>
    <section className="styles-section wrap"><div className="section-label">CAPABILITIES & ROADMAP</div><h2>More ways to swap faces.</h2><div className="four-grid feature-grid">{[
      ["Face Swap GIF", "Planned", "A face swap GIF can turn a portrait idea into a short, repeating reaction or animated greeting. We are exploring a workflow that carries a swapped face through an animated loop, with a downloadable GIF for sharing. This capability is planned; today you can create the still photo that expresses your idea. Tell us what kind of loop you would like to make."],
      ["Multiple Face Swap", "Planned", "AI multiple face swap would let you choose individual faces in a group photo and pair each one with a different reference portrait. That could make collaborative portraits and playful group compositions easier to arrange. Selectable multi-face editing is on our roadmap. For the current tool, work with one person in each photo and prepare separate edits for each portrait."],
      ["Gender Face Swap", "Try a photo swap", "Try a different presentation on a portrait you have permission to use. Choose a reference face and a source photo with the clothing, pose and scene you want to explore, then compare the result on this page. Similar angles and lighting help the two photos work together. The tool swaps facial appearance; it does not infer or change anyone’s gender identity."],
      ["Video Face Swap", "Planned", "Video face swap brings a reference face into a moving scene, where expressions, lighting and head position change from frame to frame. A useful video workflow needs consistent blending throughout the clip, plus preview and export controls. We are considering this for a future release. Share your preferred clip length and use case to help shape the roadmap; the current tool creates still photos."],
    ].map(([h,b,p]) => <article key={h}><span className="live-label">{b}</span><h3>{h}</h3><p>{p}</p>{b === "Planned" ? <a className="roadmap-link" href={`mailto:hello@pixform.ai?subject=${encodeURIComponent(`Pixform interest list: ${h}`)}&body=${encodeURIComponent(`Please add me to the interest list for ${h} and email me if it becomes available. My intended use is: `)}`}>Join the interest list by email</a> : <a className="roadmap-link" href="#face-studio">Try a portrait swap ↑</a>}</article>)}</div><p className="slot-hint roadmap-note">Email signup opens your mail app. Send your request to hello@pixform.ai to register interest in a planned feature. Release dates are not yet set; you can ask us to remove your request at any time.</p></section>
    <section className="explain wrap" aria-labelledby="good-face-swap"><div><div className="section-label">BETTER PHOTOS. BETTER STARTING POINT.</div><h2 id="good-face-swap">What makes a good face swap?</h2></div><div className="prose">
      <h3>Start with soft, even light</h3><p>Choose photos where the eyes, nose and mouth are easy to see. Light from a window or another broad source is a useful starting point. A face hidden in deep shadow gives the model less detail to work with, while harsh highlights can wash out features. You do not need a studio portrait: a clear, naturally lit photo is enough to begin.</p>
      <h3>Match the angle and expression</h3><p>Pair a front-facing source photo with a front-facing reference, or choose two portraits with a similar turn of the head. A broad smile and a closed mouth can be harder to blend than similar expressions. If the first result looks stretched or unfamiliar, try changing the reference portrait before changing the scene. One small adjustment makes it easier to understand what improved.</p>
      <h3>Keep one face clear and unobstructed</h3><p>Use a single person in each photo, with enough detail around the face to see its edges. Hands across the mouth, sunglasses, hair over the eyes and strong motion blur can hide useful features. Prefer an original photo over a compressed screenshot. Avoid cropping so tightly that the forehead or chin disappears, and keep each upload within the 10 MB limit.</p>
      <h3>Review the result before sharing</h3><p>Look closely at the eyes, teeth, jawline and the boundary between the face and surrounding hair. Check that the lighting feels consistent with the body and background. Download a result you like before its temporary link expires. If a blend looks awkward, use a better-matched pair of photos and try again with your available credits. Label the image as an edit when the context could otherwise mislead someone.</p>
    </div></section>
    <section className="faq wrap"><div><div className="section-label">A FEW THINGS TO KNOW</div><h2>Face swap questions.</h2></div><div>{faceFaqs.map(([q,a],index) => <details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{a}{index===0&&<> <Link href="/pricing">Compare plans and credit packs.</Link></>}</p></details>)}</div></section>
    <section className="related-tools wrap"><div className="section-label">RELATED TOOLS</div><h2>Keep experimenting.</h2><Link className="related-card" href="/"><h3>Image to Image AI</h3><p>Transform your photos with six artistic styles.</p></Link><p className="slot-hint">More AI image tools coming soon.</p></section>
  </main>;
}
