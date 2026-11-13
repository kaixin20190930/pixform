import type { MetadataRoute } from "next";
import { environment } from "@/lib/cloudflare";
import { coloringPublished } from "@/lib/coloring-config";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let coloring = false; try { coloring = coloringPublished(await environment()); } catch {}
  return ["", "/face-swap", "/multiple-face-swap", "/pricing", "/about", "/privacy", "/terms", ...(coloring ? ["/photo-to-coloring-page"] : [])].map(path => ({ url: `https://pixform.ai${path || "/"}` }));
}
