"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import { celebrate } from "@/lib/animations"
import { localDay } from "@/lib/dates"
import { schoolYearLabel, type Enrollment } from "@/lib/school-year"
import { promoteStudent } from "@/server/actions/students"

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function PromoteSheet({ studentId, name, from, suggestion, onOpenChange }: {
  studentId: string
  name: string
  from: Enrollment
  suggestion: Enrollment
  onOpenChange: (open: boolean) => void
}) {
  const [grade, setGrade] = useState(suggestion.grade)
  const [className, setClassName] = useState("")
  const [startsOn, setStartsOn] = useState(suggestion.startsOn)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      unwrap(await promoteStudent({ id: studentId, schoolYear: suggestion.schoolYear, grade, className: className || null, startsOn }))
      celebrate("big")
      const isFuture = startsOn > localDay(new Date())
      const msg = isFuture
        ? `${name} sẽ lên lớp ${grade} từ ${startsOn.split("-").reverse().join("/")}`
        : `${name} đã lên lớp ${grade}!`
      toast.success(msg)
      onOpenChange(false)
    } catch (e) {
      toast.error("Chưa lên lớp được", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Lên lớp cho {name}</SheetTitle>
          <SheetDescription>
            Lớp {from.grade} ({schoolYearLabel(from.schoolYear)}) → Lớp {grade} ({schoolYearLabel(suggestion.schoolYear)})
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div>
            <Label>Lớp mới</Label>
            <ToggleGroup type="single" value={String(grade)} onValueChange={(v) => v && setGrade(Number(v))} className="mt-2 flex-wrap justify-start">
              {GRADES.filter((g) => g >= from.grade).map((g) => (
                <ToggleGroupItem key={g} value={String(g)} aria-label={`Lớp ${g}`}>
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="promote-class">Tên lớp</Label>
              <Input id="promote-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder={`${grade}A…`} maxLength={20} />
            </div>
            <div>
              <Label htmlFor="promote-start">Bắt đầu từ</Label>
              <Input id="promote-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
          </div>
          <p className="rounded-2xl bg-indigo-50 p-3 text-sm text-indigo-900">
            Sao, huy hiệu và chuỗi ngày được giữ nguyên. Bài của năm cũ vẫn xem được trong Báo cáo.
          </p>
        </div>
        <SheetFooter className="flex-col">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button className="flex-[2]" onClick={save} disabled={busy || !startsOn}>
              {busy && <Loader2 className="animate-spin" />}
              Lên lớp 🎉
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
