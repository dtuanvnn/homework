import { connection } from "next/server"
import Schedule from "@/components/pages/Schedule"

export default async function SchedulePage() {
  await connection()
  return <Schedule now={new Date().toISOString()} />
}
