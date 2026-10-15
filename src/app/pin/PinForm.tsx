"use client"

import { useActionState } from "react"
import { Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { verifyParentPin, type PinState } from "@/server/actions/pin"

export default function PinForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<PinState, FormData>(verifyParentPin, {})
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-white p-8 shadow-lg shadow-indigo-600/10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-indigo-600 text-white">
          <Users className="size-7" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Chế độ Phụ huynh</h1>
        <p className="text-slate-500">Nhập mã PIN phụ huynh để tiếp tục.</p>
      </div>
      <input type="hidden" name="next" value={next} />
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
        Tiếp tục
      </Button>
    </form>
  )
}
