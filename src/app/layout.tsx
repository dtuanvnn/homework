import type { Metadata, Viewport } from "next"
import { Be_Vietnam_Pro } from "next/font/google"
import "./globals.css"
import 'katex/dist/katex.min.css'
import RegisterServiceWorker from "@/components/offline/RegisterServiceWorker"

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Homework Hub",
  description: "Giao bài, chấm bài và theo dõi tiến bộ học tập của con.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  )
}
