import UploadPageClient from "./UploadPageClient"

// "Quét bằng AI" calls Claude through a Server Action, which inherits this limit (a scan takes 30–120 s).
export const maxDuration = 300

export default function UploadPage() {
  return <UploadPageClient />
}
