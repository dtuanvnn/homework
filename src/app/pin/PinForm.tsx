"use client"

import { useActionState } from "react"
import Link from "next/link"
import { GraduationCap, Loader2, LockKeyhole, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PinRole } from "@/lib/pin"
import { verifyPin, type PinState } from "@/server/actions/pin"

const COPY: Record<PinRole | "any", { title: string; hint: string; icon: typeof LockKeyhole }> = {
  parent: { title: "Chế độ Phụ huynh", hint: "Nhập mã PIN phụ huynh để tiếp tục.", icon: Users },
  student: { title: "Chế độ Học sinh", hint: "Nhập mã PIN của em để vào học nhé.", icon: GraduationCap },
  any: { title: "Homework Hub", hint: "Nhập mã PIN để mở ứng dụng.", icon: LockKeyhole },
}

export default function PinForm({ next, role }: { next: string; role?: PinRole }) {
  const [state, action, pending] = useActionState<PinState, FormData>(verifyPin, {})
  const copy = COPY[role ?? "any"]
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-white p-8 shadow-lg shadow-indigo-600/10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-indigo-600 text-white">
          <copy.icon className="size-7" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
        <p className="text-slate-500">{copy.hint}</p>
      </div>
      <input type="hidden" name="next" value={next} />
      {role && <input type="hidden" name="role" value={role} />}
      <Input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        required
        aria-label="Mã PIN"
        aria-invalid={Boolean(state.error)}
        className="h-14 text-center text-2xl tracking-[0.5em]"
      />
      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base font-semibold">
        {pending && <Loader2 className="animate-spin" />}
        {role ? "Tiếp tục" : "Mở ứng dụng"}
      </Button>
      {role && (
        <Link href={role === "parent" ? "/student" : "/parent"} className="text-center text-sm font-medium text-indigo-600 hover:underline">
          {role === "parent" ? "Quay lại chế độ Học sinh" : "Sang chế độ Phụ huynh"}
        </Link>
      )}
    </form>
  )
}
