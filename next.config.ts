import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    // Handwritten essay answers travel as PNG data URLs; photos never do (they go straight to Storage).
    // Vercel caps request bodies at ~4.5 MB, so stay below that.
    serverActions: { bodySizeLimit: "4mb" },
  },
}

export default nextConfig
