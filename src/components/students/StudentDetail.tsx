"use client"

import { useState } from "react"
import { GraduationCap, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { unwrap } from "@/lib/action-result"
import { formatLockEnd } from "@/lib/dates"
import { schoolYearLabel, suggestPromotion, type Enrollment } from "@/lib/school-year"
import type { StudentDetailData } from "@/lib/types"
import { archiveStudent, setViewingStudent, unlockStudent } from "@/server/actions/students"
import { useAppNavigation } from "@/components/layout/AppFrame"
import { TAB_PATHS, parentPaths } from "@/components/layout/routes"
import EnrollmentSheet from "./EnrollmentSheet"
import PromoteSheet from "./PromoteSheet"
import StudentSheet from "./StudentSheet"
import LockSheet from "./LockSheet"

const fmtDay = (day: string) => day.split("-").reverse().join("/")

export default function StudentDetail({ detail, now }: { detail: StudentDetailData; now: string }) {
  const { card, years } = detail
  const { navigate } = useAppNavigation()
  const [editing, setEditing] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [yearEdit, setYearEdit] = useState<Enrollment | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [locking, setLocking] = useState(false)
  const latest = years[0]

  const fail = (title: string) => (e: unknown) => toast.error(title, { description: e instanceof Error ? e.message : undefined })

  const unlock = async () => {
    try {
      unwrap(await unlockStudent(card.id))
    } catch (e) {
      fail("Chưa mở khoá được")(e)
    }
  }

  const viewNow = async () => {
    try {
      unwrap(await setViewingStudent(card.id))
      navigate(TAB_PATHS.dashboard)
    } catch (e) {
      fail("Chưa đổi được học sinh")(e)
    }
  }

  const archive = async () => {
    try {
      unwrap(await archiveStudent(card.id))
      navigate(parentPaths.students)
    } catch (e) {
      fail("Chưa lưu trữ được")(e)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 md:p-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-3xl" aria-hidden>
            {card.avatarEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{card.name}</h1>
            <p className="text-sm text-slate-500">
              ⭐ {card.stars} sao · 🔥 {detail.streak} ngày · 🏅 {detail.badges}
            </p>
            {card.locked && (
              <p className="mt-1 text-sm text-amber-700">
                🔒 {card.lockedUntil ? `Khoá đến ${formatLockEnd(card.lockedUntil)}` : "Khoá đến khi mở"}
                {detail.lockReason ? ` · "${detail.lockReason}"` : ""}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={viewNow}>
            Xem như đang chọn
          </Button>
          {latest && (
            <Button onClick={() => setPromoting(true)}>
              <GraduationCap /> Lên lớp
            </Button>
          )}
          {card.locked ? (
            <Button variant="outline" onClick={unlock}>
              🔓 Mở khoá
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setLocking(true)}>
              🔒 Khoá tài khoản
            </Button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Các năm học</h2>
        <div className="flex flex-col divide-y rounded-2xl border border-slate-200 bg-white">
          {years.map((y) => (
            <div key={y.schoolYear} data-testid="year-row" className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">
                  {schoolYearLabel(y.schoolYear)} · Lớp {y.grade}
                  {y.className ? ` · ${y.className}` : ""}
                </div>
                <div className="text-xs text-slate-500">từ {fmtDay(y.startsOn)}</div>
              </div>
              {y.current && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Hiện tại</span>}
              <Button variant="ghost" size="icon" aria-label={`Sửa năm ${schoolYearLabel(y.schoolYear)}`} onClick={() => setYearEdit(y)}>
                <Pencil />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Button variant="ghost" className="self-start text-red-600" onClick={() => setArchiving(true)}>
        Lưu trữ học sinh
      </Button>

      {editing && <StudentSheet open onOpenChange={setEditing} editing={card} now={now} />}
      {promoting && latest && (
        <PromoteSheet studentId={card.id} name={card.name} from={latest} suggestion={suggestPromotion(latest)} onOpenChange={setPromoting} />
      )}
      {yearEdit && <EnrollmentSheet studentId={card.id} year={yearEdit} onOpenChange={(o) => !o && setYearEdit(null)} />}
      {locking && <LockSheet studentId={card.id} name={card.name} onOpenChange={setLocking} />}
      <Dialog open={archiving} onOpenChange={setArchiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lưu trữ {card.name}?</DialogTitle>
            <DialogDescription>Bé sẽ không còn trong danh sách chọn; dữ liệu vẫn được giữ.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(false)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={archive}>
              Lưu trữ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
