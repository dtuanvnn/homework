import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  CheckSquare,
  CircleHelp,
  Loader2,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  TriangleAlert,
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
import { findInvalidQuestion } from "@/components/exercise-detail/question-draft"
import { useStudent } from "@/components/layout/AppFrame"
import { GRADES, EXERCISE_KINDS } from "@/lib/library"
import { QUESTION_TYPE_LIST } from "@/lib/questions"
import { SUBJECT_LIST, SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import { unwrap } from "@/lib/action-result"
import { MAX_COUNT, MAX_REFERENCE_SETS, MIN_COUNT } from "@/lib/ai/generate"
import { generateSet } from "@/server/actions/ai-generate"
import { useLibrary } from "@/state/library-store"
import type {
  Difficulty,
  ExerciseSet,
  Question,
  QuestionType,
  SubjectId,
} from "@/lib/types"
import type { LeaveGuard } from "@/components/layout/AppFrame"

/** Shown while waiting for Claude, advancing every few seconds. */
const PROGRESS_STEPS = [
  "Đang đọc thiết lập và bài tham khảo…",
  "Đang soạn câu hỏi theo chủ đề…",
  "Đang kiểm tra lại đáp án…",
  "Sắp xong, đang hoàn thiện bộ bài…",
]

/** Topic chips for a subject + grade: the library sets' topics, then the skill tags of their questions. */
function libraryTopics(
  sets: ExerciseSet[],
  skillsBySet: Record<string, string[]>,
  subject: SubjectId,
  grade: number,
): string[] {
  const matching = sets.filter((s) => s.subject === subject && s.grade === grade)
  return [
    ...new Set(
      [
        ...matching.map((s) => s.topic),
        ...matching.flatMap((s) => skillsBySet[s.id] ?? []),
      ]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
}

export default function AIGenerate({
  skillsBySet,
  onClose,
  registerLeaveGuard,
}: {
  /** Skill tags of each set's questions, loaded by the page. */
  skillsBySet: Record<string, string[]>
  onClose: () => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}) {
  const library = useLibrary()
  const student = useStudent()
  const [subject, setSubject] = useState<SubjectId>("toan")
  const [grade, setGrade] = useState(() =>
    (GRADES as readonly number[]).includes(student.grade) ? student.grade : 3,
  )
  const [kind, setKind] = useState<"de-thi" | "luyen-tap">("luyen-tap")
  const [topics, setTopics] = useState<string[]>(() =>
    libraryTopics(library.sets, skillsBySet, "toan", grade).slice(0, 1),
  )
  const [customTopic, setCustomTopic] = useState("")
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
  /** Review notes per question id (Claude's own and anything toQuestion fixed). */
  const [notes, setNotes] = useState<Record<string, string[]>>({})
  const [shortfall, setShortfall] = useState<string | null>(null)
  const [variation, setVariation] = useState(0)
  const [editing, setEditing] = useState<Question | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const references = library.sets.filter(
    (s) => s.subject === subject && s.grade === grade && s.questionCount > 0,
  )
  const libraryTopicList = useMemo(
    () => libraryTopics(library.sets, skillsBySet, subject, grade),
    [library.sets, skillsBySet, subject, grade],
  )
  // Topics typed by the parent stay visible next to the library ones.
  const availableTopics = useMemo(
    () => [...new Set([...libraryTopicList, ...topics])],
    [libraryTopicList, topics],
  )
  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  useEffect(() => {
    if (!generating) return
    const timer = window.setInterval(
      () => setProgress((p) => Math.min(p + 1, PROGRESS_STEPS.length - 1)),
      12000,
    )
    return () => window.clearInterval(timer)
  }, [generating])

  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
  const addCustomTopic = () => {
    const topic = customTopic.trim().slice(0, 100)
    if (!topic) return
    if (!topics.includes(topic)) setTopics([...topics, topic])
    setCustomTopic("")
    setDirty(true)
  }
  const generate = async () => {
    if (!topics.length || !types.length) {
      setError("Chọn ít nhất một chủ đề và một dạng câu hỏi.")
      return
    }
    if (generating) return
    setError("")
    setProgress(0)
    setGenerating(true)
    try {
      const generated = unwrap(
        await generateSet({
          subject,
          grade,
          kind,
          topics,
          count,
          difficulty,
          types,
          referenceSetIds: referenceIds,
          note: note.trim(),
          variation,
        }),
      )
      setVariation((v) => v + 1)
      setQuestions(generated.items.map((item) => item.question))
      setNotes(
        Object.fromEntries(
          generated.items
            .filter((item) => item.notes.length)
            .map((item) => [item.question.id, item.notes]),
        ),
      )
      setShortfall(generated.shortfall)
      setResult({
        id: crypto.randomUUID(),
        title:
          generated.title ||
          `${EXERCISE_KINDS[kind]} ${SUBJECTS[subject].name} ${grade} – ${topics.join(", ")}`,
        subject,
        grade,
        kind,
        topic: topics.join(", ").slice(0, 200),
        difficulty,
        questionCount: generated.items.length,
        description: generated.description,
        source: "ai",
        status: "nhap",
        timesAssigned: 0,
        estimatedMinutes: generated.estimatedMinutes,
        createdAt: new Date().toISOString(),
      })
      setDirty(true)
      if (generated.shortfall) toast.warning(generated.shortfall)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      toast.error("Chưa tạo được bộ bài", {
        description: e instanceof Error ? e.message : "Vui lòng thử lại.",
      })
    } finally {
      setGenerating(false)
    }
  }
  const save = async () => {
    if (!result || !questions.length || !result.title.trim()) {
      toast.error("Hãy nhập tên bộ bài và giữ ít nhất một câu hỏi.")
      return
    }
    const invalid = findInvalidQuestion(questions)
    if (invalid) {
      toast.error(`Câu ${invalid.index + 1} chưa thể lưu`, {
        description: invalid.hint,
      })
      return
    }
    setSaving(true)
    const ok = await library.addSet(
      {
        ...result,
        title: result.title.trim(),
        questionCount: questions.length,
        createdAt: new Date().toISOString(),
      },
      questions,
      [],
    )
    setSaving(false)
    if (!ok) return
    toast.success("Đã lưu vào kho (nháp)", {
      description: `${questions.length} câu · Bạn có thể tiếp tục sửa trong kho.`,
    })
    onClose()
  }

  const flagged = questions.flatMap((q, index) =>
    notes[q.id]?.length ? [{ index, id: q.id, notes: notes[q.id] }] : [],
  )

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
            Một bộ bài vừa sức, dành riêng cho {student.name}.
          </p>
        </div>
      </div>
      <div className="flex gap-2 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-700">
        <CircleHelp className="size-5 shrink-0" />
        <p>
          AI soạn câu hỏi mới theo chương trình và thiết lập bên dưới. AI vẫn có
          thể nhầm, hãy kiểm tra đáp án trước khi giao bài.
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
                    setTopics(
                      libraryTopics(library.sets, skillsBySet, v as SubjectId, grade).slice(0, 1),
                    )
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
                    setTopics(
                      libraryTopics(library.sets, skillsBySet, subject, Number(v)).slice(0, 1),
                    )
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
              {!libraryTopicList.length && (
                <p className="text-sm text-slate-500">
                  Kho chưa có bài {SUBJECTS[subject].name} lớp {grade}. Hãy nhập
                  chủ đề bên dưới.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  aria-label="Thêm chủ đề"
                  value={customTopic}
                  maxLength={100}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomTopic()
                    }
                  }}
                  placeholder="Thêm chủ đề khác, VD: Bảng nhân 8"
                />
                <Button
                  variant="outline"
                  onClick={addCustomTopic}
                  disabled={!customTopic.trim()}
                >
                  <Plus />
                  Thêm
                </Button>
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
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  step={1}
                  value={count}
                  onChange={(e) => {
                    setCount(Number(e.target.value))
                    setDirty(true)
                  }}
                  className="border-0 px-0 shadow-none accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{MIN_COUNT} câu</span>
                  <span>{MAX_COUNT} câu</span>
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
                {referenceIds.length}/{MAX_REFERENCE_SETS}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Không bắt buộc · Chọn 1–{MAX_REFERENCE_SETS} bộ cùng môn và lớp.
              AI sẽ soạn câu mới theo phong cách và mức độ của các bộ này.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {references.map((s) => (
                <Button
                  key={s.id}
                  role="checkbox"
                  aria-checked={referenceIds.includes(s.id)}
                  disabled={
                    !referenceIds.includes(s.id) &&
                    referenceIds.length >= MAX_REFERENCE_SETS
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
              maxLength={500}
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
          <Button size="lg" onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Sparkles />
            )}
            {generating ? "AI đang soạn đề…" : "Tạo đề"}
          </Button>
          {generating && <GeneratingNotice step={progress} />}
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
            {result.description && (
              <p className="text-sm text-slate-600">{result.description}</p>
            )}
            <p className="text-sm text-slate-500">
              Kiểm tra đáp án, sửa từng câu hoặc kéo để đổi thứ tự trước khi
              lưu.
            </p>
          </Card>
          {generating && <GeneratingNotice step={progress} />}
          {(shortfall || flagged.length > 0) && (
            <Card className="gap-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 md:p-6">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0" />
                Cần kiểm tra
              </p>
              {shortfall && <p>{shortfall}</p>}
              <ul className="space-y-1">
                {flagged.map(({ index, id, notes: list }) => (
                  <li key={id}>
                    <span className="font-medium">Câu {index + 1}:</span>{" "}
                    {list.join(" · ")}
                  </li>
                ))}
              </ul>
            </Card>
          )}
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
                disabled={generating || saving}
                onClick={() => setPendingLeave(() => generate)}
              >
                {generating ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw />
                )}
                Tạo lại
              </Button>
              <Button
                variant="outline"
                disabled={generating || saving}
                onClick={() => setResult(null)}
              >
                <PenLine />
                Sửa thiết lập
              </Button>
              <Button
                className="col-span-2 md:ml-auto"
                onClick={save}
                disabled={
                  saving || generating || !questions.length || !result.title.trim()
                }
              >
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save />}
                Lưu vào kho (nháp)
              </Button>
            </div>
          </Card>
          <QuestionEditorSheet
            open={editing !== null}
            editing={editing}
            onOpenChange={(open) => !open && setEditing(null)}
            onSubmit={(q) => {
              setQuestions((prev) =>
                prev.map((item) => (item.id === q.id ? q : item)),
              )
              // Once the parent has edited a flagged question, stop flagging it.
              setNotes((prev) => {
                const next = { ...prev }
                delete next[q.id]
                return next
              })
            }}
            skillSuggestions={availableTopics}
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

function GeneratingNotice({ step }: { step: number }) {
  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex-row items-center gap-3 border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700"
    >
      <Sparkles className="size-5 shrink-0 animate-pulse" aria-hidden />
      <div>
        <p className="font-medium">{PROGRESS_STEPS[step]}</p>
        <p className="text-indigo-600/80">
          Thường mất 1–2 phút. Vui lòng giữ trang này mở.
        </p>
      </div>
    </Card>
  )
}
