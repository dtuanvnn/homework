import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Native renderer for handwriting pages sent to AI grading (server/ai/ink-image.ts).
  serverExternalPackages: ["@resvg/resvg-js"],
  experimental: {
    // Handwriting travels as vector strokes (lib/ink.ts), but drafts from before still carry PNG
    // data URLs; photos never do (they go straight to Storage). Vercel caps request bodies at ~4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
}

export default nextConfig
