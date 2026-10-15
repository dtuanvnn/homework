"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { unwrap } from "@/lib/action-result"
import { localDay } from "@/lib/dates"
import { schoolYearLabel, schoolYearOf } from "@/lib/school-year"
import { cn } from "@/lib/utils"
import type { StudentCard } from "@/lib/types"
import { archiveStudent, createStudent, setStudentPin, updateStudent } from "@/server/actions/students"
import { AVATAR_EMOJIS } from "./emoji"

const GRADES = [1, 2, 3, 4, 5, 6, 7]

const fail = (title: string) => (e: unknown) => toast.error(title, { description: e instanceof Error ? e.message : undefined })

export default function StudentSheet({ open, onOpenChange, editing, now }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = add a child. */
  editing: StudentCard | null
  now: string
}) {
  const thisYear = schoolYearOf(localDay(new Date(now)))
  const [emoji, setEmoji] = useState<string>(editing?.avatarEmoji ?? AVATAR_EMOJIS[0])
  const [name, setName] = useState(editing?.name ?? "")
  const [grade, setGrade] = useState(3)
  const [className, setClassName] = useState("")
  const [schoolYear, setSchoolYear] = useState(thisYear)
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      if (editing) {
        unwrap(await updateStudent({ id: editing.id, name, avatarEmoji: emoji }))
        if (pin) unwrap(await setStudentPin(editing.id, pin))
        toast.success("Đã lưu")
      } else {
        unwrap(await createStudent({ name, avatarEmoji: emoji, grade, className: className || undefined, schoolYear, pin: pin || undefined }))
        toast.success(`Đã thêm ${name}`)
      }
      onOpenChange(false)
    } catch (e) {
      fail("Chưa lưu được")(e)
    } finally {
      setBusy(false)
    }
  }

  const removePin = async () => {
    if (!editing) return
    try {
      unwrap(await setStudentPin(editing.id, null))
      toast.success("Đã xoá mã PIN")
      onOpenChange(false)
    } catch (e) {
      fail("Chưa xoá được")(e)
    }
  }

  const archive = async () => {
    if (!editing || !window.confirm(`Lưu trữ ${editing.name}? Bé sẽ không còn trong danh sách chọn; dữ liệu vẫn được giữ.`)) return
    try {
      unwrap(await archiveStudent(editing.id))
      onOpenChange(false)
    } catch (e) {
      fail("Chưa lưu trữ được")(e)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? `Sửa ${editing.name}` : "Thêm học sinh"}</SheetTitle>
          <SheetDescription>{editing ? "Đổi tên, ảnh đại diện hoặc mã PIN." : "Mỗi bé dùng thiết bị riêng và có thể có mã PIN riêng."}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div>
            <Label>Ảnh đại diện</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={e}
                  aria-pressed={emoji === e}
                  onClick={() => setEmoji(e)}
                  className={cn("grid size-11 place-items-center rounded-full text-2xl", emoji === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "bg-slate-50")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="student-name">Tên</Label>
            <Input id="student-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          {!editing && (
            <>
              <div>
                <Label>Lớp</Label>
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
                  <Label htmlFor="student-class">Tên lớp</Label>
                  <Input id="student-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Không bắt buộc" maxLength={20} />
                </div>
                <div>
                  <Label htmlFor="student-year">Năm học</Label>
                  <Select value={String(schoolYear)} onValueChange={(v) => setSchoolYear(Number(v))}>
                    <SelectTrigger id="student-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {schoolYearLabel(y)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="student-pin">{editing?.hasPin ? "Đổi mã PIN" : "Mã PIN"}</Label>
            <div className="relative">
              <Input
                id="student-pin"
                aria-label="Mã PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                placeholder="4–6 số, để trống = không PIN"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? "Ẩn mã PIN" : "Hiện mã PIN"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500"
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {editing?.hasPin && (
              <button type="button" onClick={removePin} className="mt-1 text-sm text-red-600 hover:underline">
                Xoá PIN
              </button>
            )}
          </div>
        </div>
        <SheetFooter className="justify-between">
          {editing ? (
            <Button variant="ghost" className="text-red-600" onClick={archive}>
              Lưu trữ học sinh
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {editing ? "Lưu" : "Thêm học sinh"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
