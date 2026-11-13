import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.PIXFORM_ISOLATED_PREVIEW === "1") {
  void initOpenNextCloudflareForDev({ configPath: "preview/coloring/wrangler.jsonc", envFiles: [], persist: { path: ".wrangler/coloring-preview/v3" }, remoteBindings: false });
}

const config: NextConfig = {
  ...(process.env.PIXFORM_ISOLATED_PREVIEW === "1" ? { distDir: ".next-coloring-preview" } : {}),
  poweredByHeader: false,
  trailingSlash: false,
  async headers() {
    return [
      ...(process.env.PIXFORM_ISOLATED_PREVIEW === "1" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ] },
      { source: "/api/:path*", headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "no-store" },
      ] },
      { source: "/result/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/icon", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "public, max-age=86400, immutable" }] },
      { source: "/apple-icon", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "public, max-age=86400, immutable" }] },
      { source: "/opengraph-image", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "public, max-age=86400, immutable" }] },
      { source: "/face-swap/opengraph-image", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "public, max-age=86400, immutable" }] },
    ];
  },
};
export default config;
