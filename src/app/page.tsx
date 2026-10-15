import { redirect } from "next/navigation"
import { currentRole } from "@/server/access"

/** Opens the mode the cookie unlocked; devices without one start at the child picker. */
export default async function Home() {
  const role = await currentRole()
  redirect(role === "student" ? "/student" : role === "parent" ? "/parent" : "/pin?role=student")
}
