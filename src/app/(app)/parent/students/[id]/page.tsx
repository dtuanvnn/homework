import { connection } from "next/server"
import { notFound } from "next/navigation"
import StudentDetail from "@/components/students/StudentDetail"
import { assertAccess } from "@/server/access"
import { getStudentDetail } from "@/server/students"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const ctx = await assertAccess("parent")
  const detail = await getStudentDetail(ctx.householdId, decodeURIComponent((await params).id))
  if (!detail) notFound()
  return <StudentDetail detail={detail} now={new Date().toISOString()} />
}
