import { useState } from "react"
import { CalendarDays, Check, FileText, Loader2, Monitor, Search } from "lucide-react"
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { useLibrary } from "@/state/library-store"
import { useRequiredStudent } from "@/components/layout/AppFrame"
import { SUBJECT_LIST, SUBJECTS } from "@/lib/subjects"
import { normalizeText } from "@/lib/library"
import {
  createAssignments,
  dateInput,
  localDate,
  DAY_SHORT,
  shortDate,
  type ScheduleDraft,
} from "@/lib/schedule"
import { addDays, startOfWeek } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { NewAssignment } from "@/server/actions/library"
import TimeLimitField, { suggestedLimit } from "./TimeLimitField"

export default function AssignSheet({
  date,
  setId,
  onClose,
  onCreated,
}: {
  date: Date
  /** Preselects an exercise set, e.g. from a report suggestion. */
  setId?: string
  onClose: () => void
  onCreated: (date: Date) => void
}) {
  const library = useLibrary()
  const student = useRequiredStudent()
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [subject, setSubject] = useState("all")
  const [error, setError] = useState("")
  const [draft, setDraft] = useState<ScheduleDraft>({
    exerciseSetId: setId ?? "",
    mode: "web",
    schedule: "day",
    date: dateInput(date),
    days: ["0", "2", "4"],
    start: `${dateInput(date)}T07:00`,
    dueDate: dateInput(date),
    dueTime: "20:00",
    maxAttempts: 2,
    timeLimitMinutes: null,
    note: "",
  })
  const patch = (value: Partial<ScheduleDraft>) => {
    setDraft((d) => ({ ...d, ...value }))
    setError("")
  }
  const results = library.sets.filter(
    (s) =>
      (subject === "all" || s.subject === subject) &&
      normalizeText(`${s.title} ${s.topic}`).includes(normalizeText(query)),
  )
  const selected = library.getSet(draft.exerciseSetId)
  const save = async () => {
    setSaving(true)
    try {
      if (!selected || !selected.questionCount)
        throw new Error("Hãy chọn bộ bài có ít nhất một câu hỏi.")
      // Local wall-clock times → ISO instants; the server validates again.
      const items: NewAssignment[] = createAssignments(draft).map((a) => ({
        setId: a.exerciseSetId,
        availableFrom: a.assignedDate,
        dueAt: a.dueDate,
        mode: draft.mode,
        maxAttempts: draft.maxAttempts,
        timeLimitMinutes: a.timeLimitMinutes ?? null,
        note: a.parentNote,
      }))
      const created = await library.addAssignments(items)
      toast.success(`Đã giao ${created.length} bài cho ${student.name}`, {
        description:
          draft.mode === "paper"
            ? "Chọn “In đề” trên lịch để in phiếu bài tập."
            : "Bài tập đã được thêm vào lịch.",
      })
      onCreated(new Date(created[0]?.assignedDate ?? items[0].availableFrom))
      onClose()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không thể giao bài. Vui lòng thử lại.",
      )
      setSaving(false)
    }
  }
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Giao bài mới</SheetTitle>
          <SheetDescription>
            Chọn bài và sắp xếp nhịp học cho {student.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div className="space-y-3">
            <Label>Chọn bộ bài tập</Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute top-3.5 left-3 size-4 text-slate-400" />
                <Input
                  aria-label="Tìm bộ bài tập"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm trong kho…"
                  className="pl-9"
                />
              </div>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger aria-label="Lọc theo môn">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn</SelectItem>
                  {SUBJECT_LIST.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              role="radiogroup"
              aria-label="Bộ bài tập"
              className="max-h-60 space-y-2 overflow-y-auto rounded-xl border bg-slate-50 p-2"
            >
              {results.map((s) => {
                const tone = SUBJECTS[s.subject]
                const Icon = tone.icon
                return (
                  <Button
                    key={s.id}
                    variant="outline"
                    role="radio"
                    aria-checked={s.id === draft.exerciseSetId}
                    disabled={!s.questionCount}
                    onClick={() => patch({ exerciseSetId: s.id })}
                    className={cn(
                      "h-auto min-h-16 w-full justify-start whitespace-normal p-3 text-left",
                      s.id === draft.exerciseSetId &&
                        "border-indigo-300 bg-indigo-50",
                    )}
                  >
                    <span
                      className={cn("rounded-lg p-2", tone.softBg, tone.text)}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{s.title}</span>
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Lớp {s.grade} · {s.questionCount} câu
                        {s.status === "nhap" ? " · Nháp" : ""}
                      </span>
                    </span>
                    {s.id === draft.exerciseSetId && (
                      <Check className="text-indigo-600" />
                    )}
                  </Button>
                )
              })}
              {!results.length && (
                <p className="p-3 text-sm text-slate-500">
                  Không tìm thấy bộ bài phù hợp.
                </p>
              )}
            </div>
            {selected && (
              <Badge
                variant="secondary"
                className="max-w-full whitespace-normal"
              >
                Đã chọn: {selected.title}
              </Badge>
            )}
            {selected?.status === "nhap" && (
              <p className="text-xs text-amber-700">
                Đây là bản nháp. Hãy kiểm tra nội dung trước khi giao.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Hình thức</Label>
            <ToggleGroup
              type="single"
              value={draft.mode}
              onValueChange={(v) => v && patch({ mode: v as "web" | "paper" })}
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
          {draft.mode === "web" && (
            <TimeLimitField
              id="assign-limit"
              value={draft.timeLimitMinutes}
              onChange={(timeLimitMinutes) => patch({ timeLimitMinutes })}
              suggested={suggestedLimit(selected?.estimatedMinutes)}
            />
          )}
          <div className="space-y-3">
            <Label>Lịch</Label>
            <ToggleGroup
              type="single"
              value={draft.schedule}
              onValueChange={(v) =>
                v && patch({ schedule: v as ScheduleDraft["schedule"] })
              }
              className="flex"
              aria-label="Kiểu lịch"
            >
              <ToggleGroupItem value="day">Một ngày</ToggleGroupItem>
              <ToggleGroupItem value="week">Cả tuần</ToggleGroupItem>
              <ToggleGroupItem value="later">Lên lịch</ToggleGroupItem>
            </ToggleGroup>
            {draft.schedule === "later" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="assign-start">Hiển thị từ</Label>
                  <Input
                    id="assign-start"
                    type="datetime-local"
                    value={draft.start}
                    onChange={(e) => patch({ start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assign-due-date">Ngày đến hạn</Label>
                  <Input
                    id="assign-due-date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => patch({ dueDate: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="assign-date">
                  {draft.schedule === "week"
                    ? "Chọn ngày trong tuần muốn giao"
                    : "Ngày giao bài"}
                </Label>
                <Input
                  id="assign-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
                <p className="text-xs text-slate-500">
                  Bài mở lúc 07:00
                  {draft.schedule === "week" && draft.date
                    ? ` · Tuần ${shortDate(startOfWeek(localDate(draft.date)))} – ${shortDate(addDays(startOfWeek(localDate(draft.date)), 6))}`
                    : ""}
                  .
                </p>
              </div>
            )}
            {draft.schedule === "week" && (
              <div className="space-y-2">
                <Label>Các ngày giao bài</Label>
                <ToggleGroup
                  type="multiple"
                  value={draft.days}
                  onValueChange={(days) => patch({ days })}
                  className="flex"
                  aria-label="Ngày trong tuần"
                >
                  {DAY_SHORT.map((label, i) => (
                    <ToggleGroupItem
                      key={label}
                      value={String(i)}
                      className="min-h-11 px-2"
                    >
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-xs text-indigo-600">
                  Tạo {draft.days.length} bài, mỗi ngày đã chọn một bài.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="assign-due-time">Giờ đến hạn</Label>
              <Input
                id="assign-due-time"
                type="time"
                value={draft.dueTime}
                onChange={(e) => patch({ dueTime: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Số lần làm tối đa</Label>
            <ToggleGroup
              type="single"
              value={String(draft.maxAttempts)}
              onValueChange={(v) =>
                v && patch({ maxAttempts: Number(v) as 1 | 2 })
              }
              className="flex"
              aria-label="Số lần làm tối đa"
            >
              <ToggleGroupItem value="1">1 lần</ToggleGroupItem>
              <ToggleGroupItem value="2">2 lần</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-note">Ghi chú cho con</Label>
            <Textarea
              id="assign-note"
              rows={3}
              value={draft.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Con nhớ đọc kỹ đề và kiểm tra lại nhé!"
            />
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
            <Button className="flex-[2]" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="animate-spin" /> : <CalendarDays />}
              Giao bài
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
