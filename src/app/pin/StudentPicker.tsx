"use client"

import { useActionState, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PinStudent } from "@/lib/types"
import { pickStudent, type PinState } from "@/server/actions/pin"

const avatarClass = "grid size-16 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-3xl"

export default function StudentPicker({ next, students }: { next: string; students: PinStudent[] }) {
  const [state, action, pending] = useActionState<PinState, FormData>(pickStudent, {})
  const [chosen, setChosen] = useState<PinStudent | null>(null)

  if (!students.length) {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-indigo-600/10">
        <div className="text-5xl" aria-hidden>🏫</div>
        <p className="mt-4 text-lg font-semibold text-slate-800">Nhờ bố mẹ thêm học sinh trước nhé.</p>
      </div>
    )
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-white p-8 shadow-lg shadow-indigo-600/10">
      <input type="hidden" name="next" value={next} />
      {!chosen ? (
        <>
          <h1 className="text-center text-2xl font-bold text-slate-900">Em là ai?</h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {students.map((s) => (
              <button
                key={s.id}
                type={s.hasPin ? "button" : "submit"}
                name={s.hasPin ? undefined : "studentId"}
                value={s.hasPin ? undefined : s.id}
                onClick={() => s.hasPin && setChosen(s)}
                disabled={pending}
                className="flex flex-col items-center gap-2 rounded-2xl bg-indigo-50 p-4 outline-none hover:bg-indigo-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className={avatarClass} aria-hidden>{s.avatarEmoji}</span>
                <span className="font-semibold text-slate-800">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="studentId" value={chosen.id} />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className={avatarClass} aria-hidden>{chosen.avatarEmoji}</span>
            <h1 className="text-2xl font-bold text-slate-900">Chào {chosen.name}!</h1>
            <p className="text-slate-500">Nhập mã PIN của em để vào học nhé.</p>
          </div>
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
          <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            Vào học
          </Button>
          <button type="button" onClick={() => setChosen(null)} className="flex items-center justify-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
            <ArrowLeft className="size-4" /> Đổi học sinh
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
