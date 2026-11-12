import type { Metadata } from "next";
import Link from "next/link";
import Studio from "@/components/Studio";
import { title, description, styles, faqs } from "@/lib/content";
import { billingReady, environment, ready } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/", languages: { "en-US": "/" } },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};
export default async function Home({ searchParams }: { searchParams: Promise<{ style?: string }> }) {
  const requestedStyle = (await searchParams).style;
  const initialStyle = styles.some(s => s.id === requestedStyle) ? requestedStyle! : "watercolor";
  let enabled = false,billing=false;
  try { const env=await environment();enabled = ready(env);billing=billingReady(env); } catch { /* Local preview without Cloudflare bindings. */ }
  const schema = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: "Pixform", url: "https://pixform.ai/", applicationCategory: "MultimediaApplication", operatingSystem: "Web", ...(enabled ? { offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } } : {}) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) },
    { "@context": "https://schema.org", "@type": "Organization", name: "Pixform", url: "https://pixform.ai/" },
  ];
  return <main id="main">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <section className="hero wrap">
      <div className="eyebrow"><span /> YOUR PHOTO. A NEW POSSIBILITY.</div>
      <h1>Image to Image <em>AI</em></h1>
      <p className="subtitle">Upload a photo, pick a style, discover a new look.</p>
      <Studio enabled={enabled} billingEnabled={billing} initialStyle={initialStyle} />
      <div className="hero-notes"><span>{billing?"10 free credits with sign in":"Free preview"} · <Link href="/pricing">See pricing</Link></span><span>◎ No added watermark</span><span>✧ Six creative styles</span></div>
    </section>
    <section className="steps wrap" aria-labelledby="how"><div className="section-label">A LITTLE INPUT. A NEW OUTLOOK.</div><h2 id="how">Three steps to something new.</h2>
      <div className="three-grid">{[
        ["01", "Upload your photo", "A portrait, a favorite place, a small everyday moment. Start with a JPG, PNG or WEBP."],
        ["02", "Choose a style", "Go soft with watercolor, bold with cyberpunk, or find a different perspective."],
        ["03", "Download your image", "See your original and result together. Save your favorite or try another style."],
      ].map(([n, h, p]) => <article key={n}><span className="step-number">{n}</span><h3>{h}</h3><p>{p}</p></article>)}</div>
    </section>
    <section className="explain wrap"><div><div className="section-label">FAMILIAR PHOTO. UNFAMILIAR POSSIBILITIES.</div><h2>What is image<br />to image AI?</h2><span className="big-spark" aria-hidden>✳</span></div><div className="prose">
      <p>Image to image AI takes an existing photo and generates a new version of it, using the original composition as a starting point. It can reinterpret texture, lighting and color, turning a familiar scene into something that feels painted, drawn or imagined. Your photo gives the model a visual reference instead of asking it to begin with an empty canvas.</p>
      <p>Unlike text to image, you start from your own photo. An image to image generator combines that visual reference with instructions about the result you want. This process is often called img2img. The strength of the transformation affects how closely the new image follows the original, so details and faces can change along with the style.</p>
      <p>Pixform keeps the first step simple: select an image, choose one of six styles and compare the result in the same workspace. Use this AI image transformer to explore a watercolor landscape, an anime-inspired portrait or a pencil sketch of an everyday object. Try several interpretations before choosing the one that suits your project.</p>
      <p>The wider field includes style transfer, face swapping, image expansion and restoration. These are different tasks that need different models; this page focuses on artistic reinterpretation. It is not a precise retouching tool, and results can vary. Start with a clear photo you have permission to use, then check the generated details before sharing or downloading your favorite.</p>
    </div></section>
    <section className="styles-section wrap" id="styles"><div className="section-heading"><div><div className="section-label">FIND YOUR NEW FAVORITE</div><h2>One photo. Many personalities.</h2></div><p>Choose a direction.<br />Make it your own.</p></div>
      <div className="style-gallery">{styles.map(s => <a key={s.id} href={`/#studio-${s.id}`} className="style-card"><div className={`swatch swatch-${s.id}`} style={{ backgroundColor: s.color }}><span aria-hidden>{s.mark}</span><small>STYLE {String(styles.indexOf(s) + 1).padStart(2, "0")}</small></div><h3>{s.name}</h3><p>{s.detail}</p></a>)}</div>
    </section>
    <section className="explain wrap"><div><div className="section-label">ONE PHOTO. MANY USES.</div><h2>What people make with it.</h2></div><div className="prose">
      <h3>Restyle a portrait</h3><p>Turn a phone portrait into a watercolor painting, an anime character or a pencil sketch. The face stays recognizable while the medium changes.</p>
      <h3>Rework a product shot</h3><p>Give a plain studio photo a different finish — such as oil paint for an editorial or pixel art for a sale banner — without arranging another shoot.</p>
      <h3>Sketch an idea out</h3><p>Take a rough photo of a room, an outfit or a prop and let the model reinterpret it as a concept image before anything gets built.</p>
      <h3>Keep the memory, soften the flaws</h3><p>Use a style that softens distracting details in an old or imperfect photo while keeping its composition and subject as the starting point.</p>
    </div></section>
    <section className="explain wrap"><div><div className="section-label">START WITH A PHOTO OR A PROMPT?</div><h2>Image to image or text to image?</h2></div><div className="prose"><p>Text to image starts from nothing: you describe a scene and the model invents it. Image to image — often written <strong>img2img</strong> — starts from a picture you already have and uses its composition, framing and subject as a visual reference while changing the treatment. If you want the same picture in a different medium, use image to image. If you want a picture that does not exist yet, use text to image.</p></div></section>
    <section className="faq wrap"><div><div className="section-label">A FEW THINGS TO KNOW</div><h2>Questions?<br />Start here.</h2></div><div>{faqs.map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden>+</span></summary><p>{q === "How much does one image cost?" ? <>{a.slice(0, -"See the pricing page for the full list.".length)}<Link href="/pricing">See the pricing page for the full list.</Link></> : a}</p></details>)}</div></section>
    <section className="related-tools wrap"><div className="section-label">MORE AI IMAGE TOOLS</div><h2>A different way to transform.</h2><Link className="related-card" href="/face-swap"><h3>AI Face Swap</h3><p>Upload a scene and a face. Create a new look with two photos.</p><p>Try now →</p></Link><Link className="related-card" href="/multiple-face-swap"><h3>Multiple Face Swap</h3><p>Pick up to five faces in a group photo. Use one reference face.</p><p>Try now →</p></Link></section>
    <section className="closing wrap"><span aria-hidden>✧</span><div><h2>See your photo differently.</h2><p>Start with something familiar. Make something unexpected.</p></div><a href="#studio" className="dark-button">Try a new style</a></section>
  </main>;
}
