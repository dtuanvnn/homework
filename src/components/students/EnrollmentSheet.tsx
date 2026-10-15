"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import { schoolYearLabel, type Enrollment } from "@/lib/school-year"
import { updateEnrollment } from "@/server/actions/students"

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function EnrollmentSheet({ studentId, year, onOpenChange }: {
  studentId: string
  year: Enrollment
  onOpenChange: (open: boolean) => void
}) {
  const [grade, setGrade] = useState(year.grade)
  const [className, setClassName] = useState(year.className ?? "")
  const [startsOn, setStartsOn] = useState(year.startsOn)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      unwrap(await updateEnrollment({ id: studentId, schoolYear: year.schoolYear, grade, className: className || null, startsOn }))
      toast.success("Đã lưu")
      onOpenChange(false)
    } catch (e) {
      toast.error("Chưa lưu được", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Năm học {schoolYearLabel(year.schoolYear)}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div>
            <Label>Lớp mới</Label>
            <ToggleGroup type="single" value={String(grade)} onValueChange={(v) => v && setGrade(Number(v))} className="mt-2 flex-wrap justify-start">
              {GRADES.map((g) => (
                <ToggleGroupItem key={g} value={String(g)} aria-label={`Lớp ${g}`}>
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="enrollment-class">Tên lớp</Label>
              <Input id="enrollment-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder={`${grade}A…`} maxLength={20} />
            </div>
            <div>
              <Label htmlFor="enrollment-start">Bắt đầu từ</Label>
              <Input id="enrollment-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-col">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button className="flex-[2]" onClick={save} disabled={busy || !startsOn}>
              {busy && <Loader2 className="animate-spin" />}
              Lưu
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
