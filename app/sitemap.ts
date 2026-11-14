import { textRemoverPublished } from "@/lib/text-remover-config";
import type { MetadataRoute } from "next";
import { environment } from "@/lib/cloudflare";
import { coloringPublished } from "@/lib/coloring-config";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let coloring = false,textRemover=false; try { const env=await environment();coloring=coloringPublished(env);textRemover=textRemoverPublished(env); } catch {}
  return ["", "/face-swap", "/multiple-face-swap", "/pricing", "/about", "/privacy", "/terms", ...(coloring ? ["/photo-to-coloring-page"] : []), ...(textRemover ? ["/text-remover"] : [])].map(path => ({ url: `https://pixform.ai${path || "/"}` }));
}
