import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Native renderer for handwriting pages sent to AI grading (server/ai/ink-image.ts).
  serverExternalPackages: ["@resvg/resvg-js"],
  // The offline service worker (public/sw.js): never cached, so a new deploy reaches devices.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
  experimental: {
    // Handwriting travels as vector strokes (lib/ink.ts), but drafts from before still carry PNG
    // data URLs; photos never do (they go straight to Storage). Vercel caps request bodies at ~4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
}

export default nextConfig
