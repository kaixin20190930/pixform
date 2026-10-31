import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  trailingSlash: false,
  async headers() {
    return [
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
