import { connection } from "next/server"
import Students from "@/components/pages/Students"
import { assertAccess } from "@/server/access"
import { listStudentCards } from "@/server/students"

export default async function StudentsPage() {
  await connection()
  const ctx = await assertAccess("parent")
  return <Students cards={await listStudentCards(ctx.householdId)} now={new Date().toISOString()} />
}
