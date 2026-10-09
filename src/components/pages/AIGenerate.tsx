import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  CheckSquare,
  CircleHelp,
  PenLine,
  RotateCcw,
  Save,
  Sparkles,
  Square,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import DifficultyStars from "@/components/exercise-detail/DifficultyStars"
import QuestionList from "@/components/exercise-detail/QuestionList"
import QuestionEditorSheet from "@/components/exercise-detail/QuestionEditorSheet"
import generateMock from "@/data/generate-mock"
import { TODAY } from "@/data/mock-data"
import { GRADES, EXERCISE_KINDS } from "@/lib/library"
import { QUESTION_TYPE_LIST, uid } from "@/lib/questions"
import { SUBJECT_LIST, SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import { useLibrary } from "@/state/library-store"
import type {
  Difficulty,
  ExerciseSet,
  Question,
  QuestionType,
  SubjectId,
} from "@/lib/types"
import type { LeaveGuard } from "@/components/layout/AppFrame"

const EXTRA_TOPICS: Record<SubjectId, string[]> = {
  toan: ["Bảng nhân 6–9", "Đo độ dài"],
  "tieng-viet": ["Từ chỉ hoạt động"],
  "tieng-anh": ["Unit 4: My body"],
}

export default function AIGenerate({
  onClose,
  registerLeaveGuard,
}: {
  onClose: () => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}) {
  const library = useLibrary()
  const [subject, setSubject] = useState<SubjectId>("toan")
  const [grade, setGrade] = useState(3)
  const [kind, setKind] = useState<"de-thi" | "luyen-tap">("luyen-tap")
  const [topics, setTopics] = useState<string[]>(["Bảng nhân 6–9"])
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>(2)
  const [types, setTypes] = useState<QuestionType[]>([
    "trac-nghiem",
    "dien-cho-trong",
    "tra-loi-ngan",
  ])
  const [referenceIds, setReferenceIds] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [result, setResult] = useState<ExerciseSet | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Question | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const references = library.sets.filter(
    (s) => s.subject === subject && s.grade === grade && s.questionCount > 0,
  )
  const availableTopics = useMemo(
    () => [
      ...new Set([
        ...EXTRA_TOPICS[subject],
        ...library.sets
          .filter((s) => s.subject === subject && s.grade === grade)
          .map((s) => s.topic)
          .filter(Boolean),
      ]),
    ],
    [library.sets, subject, grade],
  )
  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
  const generate = () => {
    if (!topics.length || !types.length) {
      setError("Chọn ít nhất một chủ đề và một dạng câu hỏi.")
      return
    }
    setError("")
    const qs = generateMock(
      subject,
      types,
      count,
      topics,
      difficulty,
      revision,
      referenceIds.flatMap(library.getQuestions),
    )
    setQuestions(qs)
    setRevision((v) => v + 1)
    setResult({
      id: uid("bt"),
      title: `${EXERCISE_KINDS[kind]} ${SUBJECTS[subject].name} ${grade} – ${topics.join(", ")}`,
      subject,
      grade,
      kind,
      topic: topics.join(", "),
      difficulty,
      questionCount: count,
      description: `Bản tạo mô phỏng. Yêu cầu thêm: ${note.trim() || "Không có"}. Tham khảo: ${referenceIds.map((id) => library.getSet(id)?.title).join("; ") || "Không có"}.`,
      source: "ai",
      status: "nhap",
      timesAssigned: 0,
      estimatedMinutes: count * 2,
      createdAt: TODAY.toISOString(),
    })
    setDirty(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const save = () => {
    if (!result || !questions.length || !result.title.trim()) {
      toast.error("Hãy nhập tên bộ bài và giữ ít nhất một câu hỏi.")
      return
    }
    library.addSet({ ...result, title: result.title.trim() }, questions, [])
    toast.success("Đã lưu vào kho (nháp)", {
      description: `${questions.length} câu · Bạn có thể tiếp tục sửa trong kho.`,
    })
    onClose()
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Button
        variant="ghost"
        className="w-fit text-slate-500"
        onClick={() => (dirty ? setPendingLeave(() => onClose) : onClose())}
      >
        <ArrowLeft />
        Kho bài tập
      </Button>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <Sparkles className="size-6" />
        </span>
        <div>
          <CardTitle role="heading" aria-level={1} className="text-2xl">
            Tạo bằng AI
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Một bộ bài vừa sức, dành riêng cho Minh An.
          </p>
        </div>
      </div>
      <div className="flex gap-2 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-700">
        <CircleHelp className="size-5 shrink-0" />
        <p>
          Đây là bản mô phỏng, chưa kết nối AI. Chủ đề, lớp, độ khó và yêu cầu
          thêm được lưu cùng bản nháp; câu mẫu chưa đảm bảo bám sát các yêu cầu
          này. Hãy kiểm tra trước khi giao bài.
        </p>
      </div>
      {!result ? (
        <>
          <Card className="gap-6 p-4 md:p-6">
            <CardTitle>Thiết lập bộ bài</CardTitle>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Môn</Label>
                <Select
                  value={subject}
                  onValueChange={(v) => {
                    setSubject(v as SubjectId)
                    setTopics([EXTRA_TOPICS[(v as SubjectId)][0]])
                    setReferenceIds([])
                    setDirty(true)
                  }}
                >
                  <SelectTrigger aria-label="Môn" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_LIST.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lớp</Label>
                <Select
                  value={String(grade)}
                  onValueChange={(v) => {
                    setGrade(Number(v))
                    setTopics([EXTRA_TOPICS[subject][0]])
                    setReferenceIds([])
                    setDirty(true)
                  }}
                >
                  <SelectTrigger aria-label="Lớp" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        Lớp {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label>Loại</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as typeof kind)
                    setDirty(true)
                  }}
                >
                  <SelectTrigger aria-label="Loại" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de-thi">Đề thi</SelectItem>
                    <SelectItem value="luyen-tap">Luyện tập</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>
                Chủ đề{" "}
                <span className="font-normal text-slate-400">
                  · Có thể chọn nhiều
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <Button
                    key={topic}
                    variant="outline"
                    aria-pressed={topics.includes(topic)}
                    className={cn(
                      "rounded-full",
                      topics.includes(topic) &&
                        "border-indigo-300 bg-indigo-50 text-indigo-700",
                    )}
                    onClick={() => {
                      setTopics(toggle(topics, topic))
                      setDirty(true)
                    }}
                  >
                    {topics.includes(topic) && <Check />}
                    {topic}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="ai-count" className="flex justify-between">
                  Số câu <span className="text-indigo-600">{count} câu</span>
                </Label>
                <Input
                  id="ai-count"
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={count}
                  onChange={(e) => {
                    setCount(Number(e.target.value))
                    setDirty(true)
                  }}
                  className="border-0 px-0 shadow-none accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>5 câu</span>
                  <span>30 câu</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Độ khó</Label>
                <DifficultyStars
                  value={difficulty}
                  onChange={(v) => {
                    setDifficulty(v)
                    setDirty(true)
                  }}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Dạng câu hỏi</Label>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPE_LIST.map(({ type, label }) => (
                  <Button
                    role="checkbox"
                    aria-checked={types.includes(type)}
                    key={type}
                    variant="outline"
                    className={cn(
                      "rounded-full",
                      types.includes(type) &&
                        "border-indigo-300 bg-indigo-50 text-indigo-700",
                    )}
                    onClick={() => {
                      setTypes(toggle(types, type))
                      setDirty(true)
                    }}
                  >
                    {types.includes(type) ? <CheckSquare /> : <Square />}
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Dựa trên bài trong kho</CardTitle>
              <span className="text-sm text-indigo-600">
                {referenceIds.length}/3
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Không bắt buộc · Chọn 1–3 bộ cùng môn và lớp. Bản mô phỏng sẽ lấy
              câu mẫu từ các bộ đã chọn.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {references.map((s) => (
                <Button
                  key={s.id}
                  role="checkbox"
                  aria-checked={referenceIds.includes(s.id)}
                  disabled={
                    !referenceIds.includes(s.id) && referenceIds.length === 3
                  }
                  variant="outline"
                  className={cn(
                    "h-auto min-h-20 justify-start whitespace-normal p-4 text-left",
                    referenceIds.includes(s.id) &&
                      "border-indigo-300 bg-indigo-50",
                  )}
                  onClick={() => {
                    setReferenceIds(toggle(referenceIds, s.id))
                    setDirty(true)
                  }}
                >
                  {referenceIds.includes(s.id) ? (
                    <CheckSquare className="text-indigo-600" />
                  ) : (
                    <Square className="text-slate-300" />
                  )}
                  <span>
                    <span className="block">{s.title}</span>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Lớp {s.grade} · {s.questionCount} câu ·{" "}
                      {EXERCISE_KINDS[s.kind]}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            {!references.length && (
              <p className="text-sm text-slate-500">
                Chưa có bộ bài phù hợp. Bạn vẫn có thể tạo mà không cần bài tham
                khảo.
              </p>
            )}
          </Card>
          <Card className="p-4 md:p-6">
            <Label htmlFor="ai-note">
              Yêu cầu thêm{" "}
              <span className="font-normal text-slate-400">
                · Không bắt buộc
              </span>
            </Label>
            <Textarea
              id="ai-note"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setDirty(true)
              }}
              placeholder="VD: Tập trung vào bài toán có lời văn"
            />
          </Card>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button size="lg" onClick={generate}>
            <Sparkles />
            Tạo đề
          </Button>
        </>
      ) : (
        <>
          <Card className="p-4 md:p-6">
            <CardTitle>Bản xem trước</CardTitle>
            <Label htmlFor="ai-title">Tên bộ bài</Label>
            <Input
              id="ai-title"
              value={result.title}
              onChange={(e) => setResult({ ...result, title: e.target.value })}
            />
            <p className="text-sm text-slate-500">
              {SUBJECTS[result.subject].name} · Lớp {result.grade} ·{" "}
              {questions.length} câu · {EXERCISE_KINDS[result.kind]} · Nháp
            </p>
            <p className="text-sm text-slate-500">
              Kiểm tra đáp án, sửa từng câu hoặc kéo để đổi thứ tự trước khi
              lưu.
            </p>
          </Card>
          <QuestionList
            questions={questions}
            onReorder={setQuestions}
            onEdit={setEditing}
            onDelete={(q) =>
              setQuestions((prev) => prev.filter((item) => item.id !== q.id))
            }
          />
          <Card className="sticky bottom-0 z-20 gap-2 p-3 md:bottom-4">
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button
                variant="outline"
                onClick={() => setPendingLeave(() => generate)}
              >
                <RotateCcw />
                Tạo lại
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                <PenLine />
                Sửa thiết lập
              </Button>
              <Button
                className="col-span-2 md:ml-auto"
                onClick={save}
                disabled={!questions.length || !result.title.trim()}
              >
                <Save />
                Lưu vào kho (nháp)
              </Button>
            </div>
          </Card>
          <QuestionEditorSheet
            open={editing !== null}
            editing={editing}
            onOpenChange={(open) => !open && setEditing(null)}
            onSubmit={(q) =>
              setQuestions((prev) =>
                prev.map((item) => (item.id === q.id ? q : item)),
              )
            }
            skillSuggestions={topics}
          />
        </>
      )}
      <Dialog
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && setPendingLeave(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bỏ thay đổi chưa lưu?</DialogTitle>
            <DialogDescription>
              Thiết lập hoặc bản xem trước hiện tại sẽ bị bỏ. Bộ bài chưa được
              lưu vào kho.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLeave(null)}>
              Tiếp tục sửa
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const next = pendingLeave
                setPendingLeave(null)
                next?.()
              }}
            >
              Bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
