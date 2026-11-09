import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Pixform — Free AI Image Tools for Your Photos",
  description: "Pixform transforms your photos and swaps faces with AI. Get 10 free credits with Google sign-in — 1 credit per image and 2 per face swap.",
  alternates: { canonical: "/about" },
};
export default function About() {
  return <main id="main" className="legal wrap">
    <div className="section-label">A FRESH PERSPECTIVE</div>
    <h1>About Pixform</h1>
    <p>Pixform is a small creative tool for turning photos you already own into versions you have not seen yet. Start with an image, choose a direction — watercolor, pencil, anime or pixel art — and download the result. There is no editor to learn and no timeline to manage.</p>
    <h2>Made for experimentation</h2>
    <p>The distance between an idea and an image should feel smaller. We build one task per page rather than one giant editor: <Link href="/">Image to Image</Link>, for changing the treatment of a photo you have, and <Link href="/face-swap">AI Face Swap</Link>, for putting a chosen face into a chosen scene. The first release does these two things and tries to do them well.</p>
    <h2>What you get</h2>
    <p>A new account starts with <strong>10 free credits</strong> after signing in with Google — no credit card and no trial timer. Image to Image costs 1 credit per image, and Face Swap costs 2 per successful swap. When the free credits run out, <Link href="/pricing">Pro and credit packs</Link> add more; failed generations are refunded automatically.</p>
    <h2>What to expect</h2>
    <p>AI can surprise you, and it can also change details you wanted to keep. Pixform is for creative reinterpretation, not guaranteed likeness or precise restoration. Always review the result before sharing it, and keep the original — it stays yours.</p>
    <h2>Contact</h2>
    <p>Questions or feedback? Email <a href="mailto:hello@pixform.ai">hello@pixform.ai</a>. We read everything.</p>
  </main>;
}
