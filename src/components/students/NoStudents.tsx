"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import StudentSheet from "./StudentSheet"

/** Parent pages when the household has no active child yet. */
export default function NoStudents({ now }: { now: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="text-6xl" aria-hidden>🎒</div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Chưa có học sinh nào</h2>
        <p className="mt-2 text-slate-500">Thêm bé đầu tiên để bắt đầu giao bài.</p>
        <Button className="mt-6" onClick={() => setOpen(true)}>
          Thêm học sinh đầu tiên
        </Button>
      </div>
      {open && <StudentSheet open onOpenChange={setOpen} editing={null} now={now} />}
    </div>
  )
}
