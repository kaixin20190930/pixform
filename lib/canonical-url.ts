import { styles } from "./content.ts";

const styleIds = new Set<string>(styles.map((style) => style.id));

export function canonicalRedirectLocation(input: string) {
  const url = new URL(input);
  const productionHost = url.hostname === "pixform.ai" || url.hostname === "www.pixform.ai";
  let changed = false;

  if (productionHost && url.protocol === "http:") {
    url.protocol = "https:";
    changed = true;
  }
  if (url.hostname === "www.pixform.ai") {
    url.hostname = "pixform.ai";
    changed = true;
  }
  if (url.hostname === "pixform.ai" && url.pathname === "/" && url.searchParams.has("style")) {
    const style = url.searchParams.get("style");
    url.searchParams.delete("style");
    if (style && styleIds.has(style)) url.hash = `studio-${style}`;
    changed = true;
  }

  return changed ? url.toString() : null;
}
