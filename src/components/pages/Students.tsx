"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, KeyRound, Lock, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { unwrap } from "@/lib/action-result"
import { schoolYearLabel } from "@/lib/school-year"
import type { StudentCard } from "@/lib/types"
import { restoreStudent } from "@/server/actions/students"
import { useAppNavigation, useStudent } from "@/components/layout/AppFrame"
import { parentPaths } from "@/components/layout/routes"
import StudentSheet from "@/components/students/StudentSheet"

const lockLabel = (until: string | null) =>
  until ? `Khoá đến ${new Date(until).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đang khoá"

export default function Students({ cards, now }: { cards: StudentCard[]; now: string }) {
  const viewing = useStudent()
  const { navigate } = useAppNavigation()
  const [sheet, setSheet] = useState<{ editing: StudentCard | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const active = cards.filter((c) => !c.archived)
  const archived = cards.filter((c) => c.archived)

  const restore = async (id: string) => {
    try {
      unwrap(await restoreStudent(id))
    } catch (e) {
      toast.error("Chưa khôi phục được", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const card = (c: StudentCard) => (
    <div key={c.id} data-testid="student-card" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <button type="button" disabled={c.archived} onClick={() => navigate(parentPaths.student(c.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-2xl" aria-hidden>
          {c.avatarEmoji}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {c.name}
            {viewing?.id === c.id && <span className="text-xs font-medium text-indigo-600">Đang xem ✓</span>}
            {c.locked && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                <Lock className="size-3" />
                {lockLabel(c.lockedUntil)}
              </span>
            )}
          </span>
          <span className="block text-sm text-slate-500">
            Lớp {c.grade}
            {c.className ? ` · ${c.className}` : ""} · {schoolYearLabel(c.schoolYear)}
          </span>
          <span className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span data-testid="student-stars">⭐ {c.stars}</span>
            <span className="flex items-center gap-1">
              {c.hasPin ? (
                <>
                  <KeyRound className="size-3" />
                  Có PIN
                </>
              ) : (
                "Không PIN"
              )}
            </span>
          </span>
        </span>
      </button>
      {c.archived ? (
        <Button variant="outline" size="sm" onClick={() => restore(c.id)}>
          Khôi phục
        </Button>
      ) : (
        <>
          <Button variant="ghost" size="icon" aria-label={`Sửa ${c.name}`} onClick={() => setSheet({ editing: c })}>
            <Pencil />
          </Button>
          <ChevronRight className="size-5 text-slate-400" aria-hidden />
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="hidden text-2xl font-bold text-slate-900 md:block">Học sinh</h1>
        <Button onClick={() => setSheet({ editing: null })} className="ml-auto">
          <Plus /> Thêm học sinh
        </Button>
      </div>
      {active.map(card)}
      {archived.length > 0 && (
        <>
          <button type="button" onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-1 text-sm font-medium text-slate-500">
            <ChevronDown className={showArchived ? "size-4" : "size-4 -rotate-90"} /> Đã lưu trữ ({archived.length})
          </button>
          {showArchived && archived.map(card)}
        </>
      )}
      {sheet && <StudentSheet open onOpenChange={(o) => !o && setSheet(null)} editing={sheet.editing} now={now} />}
    </div>
  )
}
