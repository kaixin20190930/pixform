import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AccountNav from "@/components/AccountNav";

export const metadata: Metadata = {
  metadataBase: new URL("https://pixform.ai"),
  applicationName: "Pixform",
  openGraph: { siteName: "Pixform", locale: "en_US", type: "website" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const email = "hello@pixform.ai";
  return <html lang="en-US"><body>
    <a className="skip" href="#main">Skip to content</a>
    <header className="header wrap">
      <Link className="brand" href="/" aria-label="Pixform home"><span className="brand-mark">p<span>✦</span></span>Pixform<span className="brand-dot">.</span></Link>
      <nav aria-label="Main navigation"><Link href="/#styles">Explore styles</Link><Link className="face-nav" href="/face-swap">Face Swap</Link><Link href="/pricing">Pricing</Link><AccountNav/></nav>
    </header>
    {children}
    <footer className="footer wrap"><div><Link className="brand footer-brand" href="/">Pixform.</Link><p>A fresh perspective on your photos.</p><small>© 2026 Pixform</small></div>
      <nav aria-label="Footer"><a href="https://rapcraft.ai">RapCraft</a><Link href="/pricing">Pricing</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>{email && <a href={`mailto:${email}`}>Contact</a>}</nav>
    </footer>
  </body></html>;
}
