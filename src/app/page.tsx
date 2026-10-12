import { redirect } from "next/navigation"
import { currentRole } from "@/server/access"

/** Opens the mode the current PIN unlocked (proxy.ts already required one). */
export default async function Home() {
  redirect((await currentRole()) === "student" ? "/student" : "/parent")
}
