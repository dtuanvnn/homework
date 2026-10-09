"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { TAB_PATHS } from "@/components/layout/routes"
import { uploadFiles } from "@/lib/upload-client"
import type { SubjectId } from "@/lib/types"
import { requestAttemptUploads, submitPaper } from "@/server/actions/attempts"
import { unwrap } from "@/lib/action-result"
import PaperSubmit from "./PaperSubmit"

/** Connects the paper-submission screen to Storage uploads and the submit action. */
export default function PaperRoute({ assignmentId, title, subject }: { assignmentId: string; title: string; subject: SubjectId }) {
  const router = useRouter()
  return (
    <PaperSubmit
      title={title}
      subject={subject}
      onClose={() => router.push(TAB_PATHS.today)}
      onSubmit={async (files) => {
        try {
          const uploaded = await uploadFiles(files, async (names) => unwrap(await requestAttemptUploads(assignmentId, names)))
          const res = await submitPaper(assignmentId, uploaded)
          if (!res.ok) toast.error(res.error)
          return res.ok
        } catch (err) {
          toast.error(err instanceof Error && err.message.startsWith("Không") ? err.message : "Chưa gửi được ảnh. Em kiểm tra mạng rồi thử lại nhé!")
          return false
        }
      }}
      onSubmitted={() => {
        // The layout (badges) is shared across routes, so refresh it after leaving.
        router.push(TAB_PATHS.today)
        router.refresh()
      }}
    />
  )
}
