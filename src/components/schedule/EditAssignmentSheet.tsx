"use client"

import { useState } from "react"
import { FileText, Loader2, Monitor, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useLibrary } from "@/state/library-store"
import { useStudent } from "@/components/layout/AppFrame"
import { SUBJECTS } from "@/lib/subjects"
import { dateTimeInput } from "@/lib/schedule"
import { cn } from "@/lib/utils"
import type { Assignment } from "@/lib/types"

export default function EditAssignmentSheet({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: Assignment
  onClose: () => void
  onSaved: (date: Date) => void
}) {
  const library = useLibrary()
  const student = useStudent()
  const set = library.getSet(assignment.exerciseSetId)
  const tone = set ? SUBJECTS[set.subject] : null
  const started = assignment.attemptCount ?? 0
  const [start, setStart] = useState(() => dateTimeInput(new Date(assignment.assignedDate)))
  const [due, setDue] = useState(() => dateTimeInput(new Date(assignment.dueDate)))
  const [mode, setMode] = useState(assignment.mode ?? "web")
  const [maxAttempts, setMaxAttempts] = useState(assignment.maxAttempts ?? 2)
  const [note, setNote] = useState(assignment.parentNote ?? "")
  const [busy, setBusy] = useState<"save" | "delete" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Đã có lỗi xảy ra. Vui lòng thử lại.")
    setBusy(null)
  }
  const save = async () => {
    const from = new Date(start)
    const until = new Date(due)
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime()))
      return setError("Ngày và giờ chưa hợp lệ.")
    if (until <= from) return setError("Hạn nộp phải sau thời điểm mở bài.")
    setBusy("save")
    try {
      await library.editAssignment(assignment.id, {
        availableFrom: from.toISOString(),
        dueAt: until.toISOString(),
        mode,
        maxAttempts,
        note,
      })
      toast.success("Đã cập nhật bài giao")
      onSaved(from)
      onClose()
    } catch (e) {
      fail(e)
    }
  }
  const remove = async () => {
    setBusy("delete")
    try {
      await library.removeAssignment(assignment.id)
      toast.success("Đã xóa bài giao")
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sửa bài giao</SheetTitle>
          <SheetDescription>
            Đổi lịch hoặc cách làm bài của {student.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div className={cn("flex items-center gap-3 rounded-xl border p-3", tone?.softBg, tone?.border)}>
            {tone && (
              <span className={cn("rounded-lg bg-white/70 p-2", tone.text)}>
                <tone.icon className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{set?.title ?? "Bộ bài đã bị xóa"}</span>
              {set && (
                <span className="mt-1 block text-xs text-slate-500">
                  Lớp {set.grade} · {set.questionCount} câu
                </span>
              )}
            </span>
          </div>
          {started > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Con đã bắt đầu làm bài này nên không đổi được hình thức
              {started > 1 ? " và số lần làm" : ""}.
            </p>
          )}
          <div className="space-y-2">
            <Label>Hình thức</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as "web" | "paper")}
              disabled={started > 0}
              className="flex"
              aria-label="Hình thức"
            >
              <ToggleGroupItem value="web">
                <Monitor />
                Làm trên web
              </ToggleGroupItem>
              <ToggleGroupItem value="paper">
                <FileText />
                In ra giấy
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-start">Hiển thị từ</Label>
            <Input
              id="edit-start"
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                setError("")
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due">Hạn nộp</Label>
            <Input
              id="edit-due"
              type="datetime-local"
              value={due}
              onChange={(e) => {
                setDue(e.target.value)
                setError("")
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Số lần làm tối đa</Label>
            <ToggleGroup
              type="single"
              value={String(maxAttempts)}
              onValueChange={(v) => v && setMaxAttempts(Number(v) as 1 | 2)}
              className="flex"
              aria-label="Số lần làm tối đa"
            >
              <ToggleGroupItem value="1" disabled={started > 1}>
                1 lần
              </ToggleGroupItem>
              <ToggleGroupItem value="2">2 lần</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-note">Ghi chú cho con</Label>
            <Textarea
              id="edit-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Con nhớ đọc kỹ đề và kiểm tra lại nhé!"
            />
          </div>
          <div className="space-y-3 border-t pt-5">
            {confirmDelete ? (
              <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {started > 0
                    ? `Xóa bài giao này sẽ xóa luôn bài làm và điểm của ${student.name}. Không hoàn tác được.`
                    : "Xóa bài giao này khỏi lịch?"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                    Không xóa
                  </Button>
                  <Button variant="destructive" className="flex-1" disabled={busy !== null} onClick={remove}>
                    {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Xóa
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={busy !== null}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Xóa bài giao
              </Button>
            )}
          </div>
        </div>
        <SheetFooter className="flex-col">
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Hủy
            </Button>
            <Button className="flex-[2]" disabled={busy !== null} onClick={save}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
              Lưu thay đổi
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
