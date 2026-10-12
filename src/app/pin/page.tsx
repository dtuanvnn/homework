import PinForm from "./PinForm"

export const metadata = { title: "Nhập mã PIN · Homework Hub" }

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams
  return (
    <main className="grid min-h-dvh place-items-center bg-indigo-50/60 p-4">
      <PinForm next={next ?? "/"} role={role === "parent" || role === "student" ? role : undefined} />
    </main>
  )
}
