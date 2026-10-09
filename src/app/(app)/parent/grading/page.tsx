import { connection } from "next/server"
import Grading from "@/components/pages/Grading"
import { loadGradingQueue } from "./data"

export default async function GradingPage() {
  await connection()
  const items = await loadGradingQueue()
  return <Grading items={items} now={new Date().toISOString()} />
}
