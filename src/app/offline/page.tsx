import type { Metadata } from "next"
import OfflineApp from "@/components/offline/OfflineApp"

export const metadata: Metadata = { title: "Làm bài offline · Homework Hub" }

/** Static on purpose: the service worker caches it and serves it without network. The data lives on the device. */
export default function OfflinePage() {
  return <OfflineApp />
}
