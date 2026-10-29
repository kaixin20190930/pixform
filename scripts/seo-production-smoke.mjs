const base = (process.env.SEO_BASE_URL || "https://pixform.ai").replace(/\/$/, "");
const canonicalOrigin = (process.env.SEO_CANONICAL_ORIGIN || base).replace(/\/$/, "");
const canonicalPaths = ["/", "/face-swap", "/pricing", "/about", "/privacy", "/terms"];
const retiredClaims = /without signup|no account|per IP|per hour|attempts per/i;

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
    .replace(/&(?:nbsp|amp|quot|#x27|#39);/gi, " ")
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

for (const path of ["/", "/face-swap"]) {
  const main = mainHtml(pages.get(path));
  assert(/href="\/pricing"/.test(main), `${path} is missing a contextual link to /pricing`);
  assert(!retiredClaims.test(textContent(main)), `${path} still exposes a retired free-access claim`);
}

for (const path of ["/", "/face-swap", "/pricing"]) {
  const main = mainHtml(pages.get(path));
  const faq = jsonLd(main).find((entry) => entry?.["@type"] === "FAQPage");
  const visibleQuestions = [...main.matchAll(/<summary\b/g)].length;
  assert(faq, `${path} is missing FAQPage structured data`);
  assert(faq.mainEntity?.length === visibleQuestions, `${path} FAQ schema has ${faq.mainEntity?.length || 0} questions but the page shows ${visibleQuestions}`);
}

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

console.log(`SEO production smoke passed. /pricing visible word count: ${pricingWords}.`);
