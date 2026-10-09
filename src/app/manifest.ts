import type { MetadataRoute } from "next"

/** Lets the app be added to the iPad/iPhone home screen and open full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homework Hub",
    short_name: "Homework",
    description: "Giao bài, chấm bài và theo dõi tiến bộ học tập của con.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }
}
