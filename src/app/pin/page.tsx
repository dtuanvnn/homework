import PinForm from "./PinForm"
import StudentPicker from "./StudentPicker"
import { listPinStudents } from "@/server/students"

export const metadata = { title: "Nhập mã PIN · Homework Hub" }

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams
  return (
    <main className="grid min-h-dvh place-items-center bg-indigo-50/60 p-4">
      {role === "parent" ? <PinForm next={next ?? "/parent"} /> : <StudentPicker next={next ?? "/student"} students={await listPinStudents()} />}
    </main>
  )
}
