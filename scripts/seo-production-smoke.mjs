const base = (process.env.SEO_BASE_URL || "https://pixform.ai").replace(/\/$/, "");
const canonicalOrigin = (process.env.SEO_CANONICAL_ORIGIN || base).replace(/\/$/, "");
const canonicalPaths = ["/", "/face-swap", "/multiple-face-swap", "/pricing", "/about", "/privacy", "/terms"];
const retiredClaims = /without signup|without an account|no signup|no account|per IP|per hour|attempts per|attempts\s*\/\s*hour/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mainHtml(html) {
  return html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || "";
}

function textContent(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#x27|#39);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length || 0;
}

function jsonLd(html) {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const value = JSON.parse(match[1]);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
}

const pages = new Map();
for (const path of canonicalPaths) {
  const response = await fetch(`${base}${path}`);
  const html = await response.text();
  assert(response.status === 200, `${path} returned ${response.status}`);
  assert(!/\bnoindex\b/i.test(response.headers.get("x-robots-tag") || ""), `${path} has an X-Robots noindex`);
  assert(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html), `${path} has a robots noindex`);
  const expectedCanonical = `${canonicalOrigin}${path}`;
  const declaredCanonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  assert(declaredCanonical && new URL(declaredCanonical).href === new URL(expectedCanonical).href, `${path} is missing canonical ${expectedCanonical}`);
  pages.set(path, html);
}

for (const path of ["/", "/face-swap", "/about"]) {
  const main = mainHtml(pages.get(path));
  assert(/href="\/pricing"/.test(main), `${path} is missing a contextual link to /pricing`);
  assert(!retiredClaims.test(textContent(main)), `${path} still exposes a retired free-access claim`);
}
assert(!/href="[^"#]*\?style=/.test(mainHtml(pages.get("/"))), "homepage still exposes crawlable style query links");

const expectedFaqCounts = new Map([["/", 8], ["/face-swap", 9], ["/pricing", 8], ["/multiple-face-swap", 8]]);
for (const path of ["/", "/face-swap", "/pricing", "/multiple-face-swap"]) {
  const main = mainHtml(pages.get(path));
  const faq = jsonLd(main).find((entry) => entry?.["@type"] === "FAQPage");
  const visibleFaqs = [...main.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)].map((match) => {
    const block = match[1];
    const summary = block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || "";
    const answer = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
    return {
      name: textContent(summary.replace(/<span\b[^>]*aria-hidden[^>]*>[\s\S]*?<\/span>/gi, "")),
      text: textContent(answer),
    };
  });
  assert(faq, `${path} is missing FAQPage structured data`);
  assert(visibleFaqs.length === expectedFaqCounts.get(path), `${path} shows ${visibleFaqs.length} FAQs; expected ${expectedFaqCounts.get(path)}`);
  assert(faq.mainEntity?.length === visibleFaqs.length, `${path} FAQ schema has ${faq.mainEntity?.length || 0} questions but the page shows ${visibleFaqs.length}`);
  faq.mainEntity.forEach((entry, index) => {
    assert(entry.name === visibleFaqs[index].name, `${path} FAQ ${index + 1} question text differs from JSON-LD`);
    assert(entry.acceptedAnswer?.text === visibleFaqs[index].text, `${path} FAQ ${index + 1} answer text differs from JSON-LD`);
  });
}
const pricingSchema = jsonLd(mainHtml(pages.get("/pricing")));
assert(pricingSchema.some((entry) => entry?.["@type"] === "WebPage"), "/pricing is missing WebPage structured data");
assert(!pricingSchema.some((entry) => entry?.["@type"] === "Product" || entry?.["@type"] === "Offer"), "/pricing still exposes merchant Product or Offer structured data");
assert(pages.get("/pricing").includes("<title>Pricing — 10 Free Credits, Pro from $9/mo | Pixform</title>"), "/pricing has the wrong title");
assert(pages.get("/pricing").includes('name="description" content="10 free credits to start, then Pro from $9/mo or one-time packs from $9. Image to Image costs 1 credit, AI Face Swap 2. Cancel anytime."'), "/pricing has the wrong meta description");

const pricingWords = wordCount(textContent(mainHtml(pages.get("/pricing"))));
assert(pricingWords >= 500 && pricingWords <= 700, `/pricing has ${pricingWords} words; expected 500-700`);

const sitemapResponse = await fetch(`${base}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
assert(sitemapResponse.status === 200, `/sitemap.xml returned ${sitemapResponse.status}`);
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(locations.length === canonicalPaths.length, `sitemap has ${locations.length} URLs; expected ${canonicalPaths.length}`);
for (const path of canonicalPaths) assert(locations.includes(`${canonicalOrigin}${path}`), `sitemap is missing ${canonicalOrigin}${path}`);
assert(locations.every((location) => !location.includes("?")), "sitemap contains a parameter URL");

const robotsResponse = await fetch(`${base}/robots.txt`);
const robots = await robotsResponse.text();
assert(robotsResponse.status === 200, `/robots.txt returned ${robotsResponse.status}`);
assert(/Allow:\s*\//i.test(robots), "robots.txt does not allow the public site");
assert(robots.includes(`${canonicalOrigin}/sitemap.xml`), "robots.txt is missing the canonical sitemap URL");

if (base === canonicalOrigin && canonicalOrigin === "https://pixform.ai") {
  for (const path of ["/", "/terms", "/?style=anime"]) {
    const response = await fetch(`http://pixform.ai${path}`, { redirect: "manual" });
    assert(response.status === 308, `HTTP ${path} returned ${response.status}; expected 308`);
    assert(response.headers.get("location")?.startsWith("https://pixform.ai/"), `HTTP ${path} does not redirect to the HTTPS apex`);
  }
  const styleResponse = await fetch(`${base}/?style=anime`, { redirect: "manual" });
  assert(styleResponse.status === 308, `style parameter URL returned ${styleResponse.status}; expected 308`);
  assert(styleResponse.headers.get("location") === `${canonicalOrigin}/#studio-anime`, "style parameter URL has the wrong canonical destination");
}

for (const path of ["/icon?seo-check", "/apple-icon?seo-check", "/opengraph-image?seo-check", "/face-swap/opengraph-image"]) {
  const response = await fetch(`${base}${path}`);
  assert(response.status === 200, `${path} returned ${response.status}`);
  assert(/\bnoindex\b/i.test(response.headers.get("x-robots-tag") || ""), `${path} is missing X-Robots-Tag noindex`);
  assert((response.headers.get("content-type") || "").startsWith("image/"), `${path} is not served as an image`);
}

console.log(`SEO production smoke passed. /pricing visible word count: ${pricingWords}.`);
