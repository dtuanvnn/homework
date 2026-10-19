"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowLeft, CheckCircle2, GripVertical, Languages, Layers, ListPlus, Loader2, Plus, Save, Send, Sparkles, Trash2, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { LeaveGuard } from "@/components/layout/AppFrame"
import { useRequiredStudent } from "@/components/layout/AppFrame"
import { unwrap } from "@/lib/action-result"
import { MAX_EXPLANATION } from "@/lib/ai/flashcard"
import { MAX_WORDS, isValidWord, parseWordList, vocabQuestion } from "@/lib/flashcard"
import { formatVietnameseDate } from "@/lib/format"
import { GRADES } from "@/lib/library"
import { NO_VOICE, speak, useEnglishVoice } from "@/lib/speech"
import { cn } from "@/lib/utils"
import type { ExerciseSet, ExerciseSetStatus, Question } from "@/lib/types"
import { explainWords } from "@/server/actions/ai-flashcard"
import { useLibrary } from "@/state/library-store"

/*
 * "Từ vựng (Flashcard)" builder: the parent pastes a unit's word list, AI
 * writes one short English explanation per word, the parent edits and saves.
 * Each card becomes a `tu-vung` question (lib/flashcard.ts).
 */

interface WordCard {
  /** Question id: kept for saved words, a new UUID otherwise. */
  id: string
  word: string
  definition: string
}

type SaveAction = "nhap" | "san-sang" | "assign" | "leave"

const cardsOf = (questions: Question[]): WordCard[] =>
  questions.flatMap((q) => (q.type === "tu-vung" ? [{ id: q.id, word: q.word, definition: q.prompt }] : []))

/** What's wrong with a card before saving, or null. */
function cardIssue(c: WordCard): string | null {
  if (!isValidWord(c.word)) return `“${c.word.trim() || "(trống)"}”: từ chỉ gồm chữ cái, dấu cách, gạch nối hoặc dấu nháy.`
  if (!c.definition.trim()) return `“${c.word.trim()}” chưa có giải thích.`
  if (c.definition.trim().length > MAX_EXPLANATION) return `Giải thích của “${c.word.trim()}” dài quá ${MAX_EXPLANATION} ký tự.`
  return null
}

export default function FlashcardBuilder({
  initialSet,
  initialQuestions = [],
  onClose,
  registerLeaveGuard,
}: {
  initialSet?: ExerciseSet
  initialQuestions?: Question[]
  onClose: () => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}) {
  const library = useLibrary()
  const student = useRequiredStudent()
  const hasVoice = useEnglishVoice()
  const [setId] = useState(() => initialSet?.id ?? crypto.randomUUID())
  const [title, setTitle] = useState(initialSet?.title ?? "")
  const [topic, setTopic] = useState(initialSet?.topic ?? "")
  const [grade, setGrade] = useState(initialSet?.grade ?? student.grade)
  const [status, setStatus] = useState<ExerciseSetStatus>(initialSet?.status ?? "nhap")
  const [usedAi, setUsedAi] = useState(initialSet?.source === "ai")
  const [raw, setRaw] = useState("")
  const [cards, setCards] = useState<WordCard[]>(() => cardsOf(initialQuestions))
  /** Ids of cards the AI is writing for. */
  const [writing, setWriting] = useState<Set<string>>(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [saving, setSaving] = useState<SaveAction | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const parsed = useMemo(() => parseWordList(raw, cards.map((c) => c.word)), [raw, cards])
  const busy = saving !== null || writing.size > 0

  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }
  const patchCard = (id: string, p: Partial<WordCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)))
    setDirty(true)
  }

  /** Adds the pasted words as new cards (repeats of existing cards are skipped); returns the new cards. */
  const addPasted = (): WordCard[] => {
    if (!parsed.words.length) {
      if (!cards.length) toast.error("Hãy dán ít nhất một từ tiếng Anh.")
      return []
    }
    const added = parsed.words.map((word) => ({ id: crypto.randomUUID(), word, definition: "" }))
    setCards((prev) => [...prev, ...added])
    setRaw("")
    setDirty(true)
    if (parsed.overflow) toast.warning(`Mỗi bộ có tối đa ${MAX_WORDS} từ – đã bỏ ${parsed.overflow} từ cuối.`)
    return added
  }

  const runAi = async (targets: WordCard[], avoid?: Record<string, string>) => {
    if (!targets.length) return
    const ids = new Set(targets.map((c) => c.id))
    setWriting((prev) => new Set([...prev, ...ids]))
    try {
      const explained = unwrap(await explainWords({ words: targets.map((c) => c.word.trim()), topic, grade, avoid }))
      const byWord = new Map(Object.entries(explained).map(([w, d]) => [w.toLowerCase(), d]))
      setCards((prev) => prev.map((c) => (ids.has(c.id) && byWord.has(c.word.trim().toLowerCase()) ? { ...c, definition: byWord.get(c.word.trim().toLowerCase())! } : c)))
      setUsedAi(true)
      setDirty(true)
      const missing = targets.length - byWord.size
      if (missing > 0) toast.warning(`AI chưa viết được ${missing} giải thích`, { description: "Bạn tự viết hoặc bấm “Viết lại” ở thẻ đó." })
      else toast.success(targets.length > 1 ? `AI đã viết giải thích cho ${targets.length} từ` : `Đã viết lại giải thích cho “${targets[0].word.trim()}”`)
    } catch (e) {
      toast.error("AI chưa viết được giải thích", { description: e instanceof Error ? e.message : "Vui lòng thử lại." })
    } finally {
      setWriting((prev) => new Set([...prev].filter((id) => !ids.has(id))))
    }
  }

  const explainAll = () => {
    const added = addPasted()
    const targets = [...cards.filter((c) => !c.definition.trim()), ...added].filter((c) => isValidWord(c.word))
    if (!targets.length) {
      if (cards.length) toast("Mọi từ đã có giải thích. Bấm “Viết lại” ở từng thẻ để AI viết cách khác.")
      return
    }
    void runAi(targets)
  }

  const removeCard = (card: WordCard, index: number) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id))
    setDirty(true)
    toast(`Đã xóa từ “${card.word.trim()}”`, {
      action: {
        label: "Hoàn tác",
        onClick: () => setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev.slice(0, index), card, ...prev.slice(index)])),
      },
    })
  }

  const persist = async (next: ExerciseSetStatus, action: SaveAction): Promise<boolean> => {
    if (!title.trim()) {
      setTitleError(true)
      document.getElementById("flashcard-title")?.focus()
      toast.error("Hãy đặt tên cho bộ từ vựng.")
      return false
    }
    if (!cards.length) {
      toast.error("Bộ từ vựng cần ít nhất một từ.")
      return false
    }
    const bad = cards.find((c) => cardIssue(c))
    if (bad) {
      document.getElementById(`card-${bad.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("Chưa lưu được", { description: cardIssue(bad)! })
      return false
    }
    const set: ExerciseSet = {
      id: setId,
      title: title.trim(),
      subject: "tieng-anh",
      grade,
      topic: topic.trim(),
      description: `${cards.length} từ vựng tiếng Anh`,
      questionCount: cards.length,
      estimatedMinutes: Math.min(60, Math.max(5, cards.length)),
      difficulty: initialSet?.difficulty ?? 2,
      kind: "chu-de",
      source: usedAi ? "ai" : "thu-cong",
      status: next,
      format: "flashcard",
      timesAssigned: initialSet?.timesAssigned ?? 0,
      createdAt: initialSet?.createdAt ?? new Date().toISOString(),
    }
    setSaving(action)
    const ok = await library.saveSet(set, cards.map((c) => ({ id: c.id, ...vocabQuestion(c.word, c.definition) }) as Question), [])
    setSaving(null)
    if (ok) {
      setStatus(next)
      setDirty(false)
    }
    return ok
  }

  const assign = async () => {
    if ((dirty || status !== "san-sang") && !(await persist("san-sang", "assign"))) return
    setSaving("assign")
    const assignment = await library.assignSet(setId)
    setSaving(null)
    if (!assignment) return
    toast.success(`Đã giao bài cho ${student.name}`, { description: `“${title.trim()}” · Hạn ${formatVietnameseDate(assignment.dueDate)}` })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const position = (id: string | number) => cards.findIndex((c) => c.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã chọn thẻ từ vị trí ${position(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Di chuyển tới vị trí ${position(over.id)}.` : undefined),
    onDragEnd: ({ over }) => (over ? `Đã đặt thẻ từ vào vị trí ${position(over.id)}.` : "Đã hủy sắp xếp."),
    onDragCancel: () => "Đã hủy sắp xếp.",
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setCards((prev) => arrayMove(prev, position(active.id) - 1, position(over.id) - 1))
    setDirty(true)
  }

  const spinnerOr = (action: SaveAction, icon: React.ReactNode) => (saving === action ? <Loader2 className="animate-spin" /> : icon)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8 md:gap-7">
      <header className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="hidden h-10 w-fit -translate-x-3 text-slate-500 md:inline-flex" onClick={() => (dirty ? setPendingLeave(() => onClose) : onClose())}>
          <ArrowLeft />
          Kho bài tập
        </Button>
        <div className="flex items-start gap-3.5">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white shadow-sm">
            <Languages className="size-6" />
            <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-lg bg-green-600 text-white ring-2 ring-white">
              <Layers className="size-3.5" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-green-200 bg-green-50/60 font-semibold text-green-700">
                <Layers className="size-3.5" />
                Từ vựng (Flashcard)
              </Badge>
              {dirty && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  Chưa lưu
                </Badge>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{initialSet ? "Sửa bộ từ vựng" : "Tạo bộ từ vựng"}</h1>
            <p className="mt-1 text-sm text-slate-500">Con học thẻ từ, nghe phát âm rồi viết tay từng từ theo giải thích tiếng Anh.</p>
          </div>
        </div>
      </header>

      <Card className="gap-5 p-4 md:p-6">
        <div>
          <CardTitle className="text-lg">1. Thông tin bộ từ & danh sách từ</CardTitle>
          <CardDescription className="mt-0.5">Môn Tiếng Anh · tối đa {MAX_WORDS} từ</CardDescription>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="space-y-2 md:col-span-12">
            <Label htmlFor="flashcard-title">Tên bộ</Label>
            <Input
              id="flashcard-title"
              value={title}
              onChange={(e) => {
                change(setTitle)(e.target.value)
                if (e.target.value.trim()) setTitleError(false)
              }}
              placeholder="Unit 3 – Từ mới"
              aria-invalid={titleError}
              className={cn(titleError && "border-red-400 focus-visible:ring-red-200")}
            />
          </div>
          <div className="space-y-2 md:col-span-8">
            <Label htmlFor="flashcard-topic">Chủ đề</Label>
            <Input id="flashcard-topic" value={topic} onChange={(e) => change(setTopic)(e.target.value)} placeholder="Where Do Animals Live?" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Lớp</Label>
            <Select value={String(grade)} onValueChange={(v) => change(setGrade)(Number(v))}>
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
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="flashcard-words">Dán danh sách từ (mỗi dòng một từ)</Label>
          <Textarea
            id="flashcard-words"
            rows={6}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"habitat\ndesert\nrainforest\npolar bear"}
            className="min-h-36 font-medium leading-relaxed"
            lang="en"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant="secondary" className="bg-green-50 font-semibold text-green-700">
              Đã nhận {parsed.words.length} từ
            </Badge>
            <span>Dòng trống và từ trùng được tự động bỏ qua. Có thể dán “a / b / c” trên một dòng.</span>
            {parsed.duplicateCount > 0 && <span className="font-medium text-amber-700">Bỏ {parsed.duplicateCount} từ trùng</span>}
            {parsed.overflow > 0 && <span className="font-medium text-amber-700">Quá {MAX_WORDS} từ: bỏ {parsed.overflow} từ cuối</span>}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="lg" disabled={busy || !parsed.words.length} onClick={() => addPasted()}>
            <ListPlus />
            Tạo thẻ từ
          </Button>
          <Button size="lg" disabled={busy || (!parsed.words.length && !cards.some((c) => !c.definition.trim()))} onClick={explainAll}>
            {writing.size > 1 ? <Loader2 className="animate-spin" /> : <Sparkles />}
            AI viết giải thích
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-4" aria-label="Thẻ từ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">2. Kiểm tra & chỉnh sửa thẻ từ ({cards.length} từ)</CardTitle>
            <CardDescription className="mt-0.5">Nghe thử phát âm, sửa giải thích tiếng Anh hoặc kéo tay nắm để đổi thứ tự.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || cards.length >= MAX_WORDS}
            onClick={() => {
              setCards((prev) => [...prev, { id: crypto.randomUUID(), word: "", definition: "" }])
              setDirty(true)
            }}
          >
            <Plus className="size-4" />
            Thêm thẻ từ
          </Button>
        </div>

        {cards.length === 0 ? (
          <Card className="items-center gap-3 border-dashed py-10 text-center shadow-none">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <Layers className="size-6" />
            </div>
            <CardTitle className="text-base">Chưa có thẻ từ vựng nào</CardTitle>
            <CardDescription className="max-w-sm">Dán danh sách từ ở khung trên rồi bấm “AI viết giải thích”, hoặc “Tạo thẻ từ” để tự viết.</CardDescription>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: "Nhấn phím cách để nhấc thẻ từ, dùng phím mũi tên để đổi vị trí, nhấn phím cách lần nữa để thả." },
            }}
          >
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {cards.map((card, i) => (
                  <WordCardEditor
                    key={card.id}
                    card={card}
                    index={i}
                    writing={writing.has(card.id)}
                    disabled={busy}
                    hasVoice={hasVoice}
                    onChange={(p) => patchCard(card.id, p)}
                    onRewrite={() => void runAi([card], card.definition.trim() ? { [card.word.trim()]: card.definition } : undefined)}
                    onDelete={() => removeCard(card, i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <Card className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className={cn("text-xs font-medium", dirty ? "text-amber-700" : "text-slate-500")}>
            {saving ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : `${cards.length} từ`}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button type="button" variant="outline" className="col-span-2 sm:col-span-1" disabled={busy} onClick={() => void assign()}>
              {spinnerOr("assign", <Send className="size-4" />)}
              Giao bài này
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={async () => { if (await persist("nhap", "nhap")) toast.success("Đã lưu nháp") }}>
              {spinnerOr("nhap", <Save className="size-4" />)}
              Lưu nháp
            </Button>
            <Button type="button" disabled={busy} onClick={async () => { if (await persist("san-sang", "san-sang")) toast.success("Đã lưu · Bộ từ sẵn sàng để giao") }}>
              {spinnerOr("san-sang", <CheckCircle2 className="size-4" />)}
              Lưu & sẵn sàng
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={pendingLeave !== null} onOpenChange={(open) => !open && setPendingLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bạn có thay đổi chưa lưu</DialogTitle>
            <DialogDescription>Lưu nháp bộ từ vựng để giữ lại, hoặc bỏ các thay đổi vừa thực hiện.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                const next = pendingLeave
                setPendingLeave(null)
                next?.()
              }}
            >
              Bỏ thay đổi
            </Button>
            <Button
              disabled={saving !== null}
              onClick={async () => {
                const next = pendingLeave
                if (!(await persist(status, "leave"))) {
                  setPendingLeave(null)
                  return
                }
                toast.success(status === "nhap" ? "Đã lưu nháp" : "Đã lưu")
                setPendingLeave(null)
                next?.()
              }}
            >
              {spinnerOr("leave", null)}
              Lưu & thoát
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WordCardEditor({
  card,
  index,
  writing,
  disabled,
  hasVoice,
  onChange,
  onRewrite,
  onDelete,
}: {
  card: WordCard
  index: number
  writing: boolean
  disabled: boolean
  hasVoice: boolean
  onChange: (p: Partial<WordCard>) => void
  onRewrite: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const [speaking, setSpeaking] = useState(false)
  const n = index + 1
  const label = card.word.trim() || `số ${n}`
  return (
    <Card
      ref={setNodeRef}
      id={`card-${card.id}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative scroll-mt-24 gap-3.5 border-slate-200/80 bg-white p-4 transition-shadow md:p-5", isDragging && "z-20 border-green-300 shadow-xl ring-2 ring-green-500/20")}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Kéo để đổi thứ tự từ ${label}`}
          className={cn("-ml-2 size-10 touch-none rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-600", isDragging ? "cursor-grabbing" : "cursor-grab")}
        >
          <GripVertical className="size-5" />
        </Button>
        <Badge variant="secondary" className="h-7 min-w-7 justify-center rounded-full bg-green-500 px-2 text-xs font-bold text-white">
          {n}
        </Badge>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={card.word}
            onChange={(e) => onChange({ word: e.target.value })}
            aria-label={`Từ vựng ${n}`}
            placeholder="word"
            lang="en"
            aria-invalid={card.word.trim() !== "" && !isValidWord(card.word)}
            className="h-10 border-transparent bg-transparent px-2 text-xl font-bold tracking-tight text-slate-900 shadow-none hover:border-slate-200 focus-visible:border-green-500 focus-visible:bg-white md:text-2xl"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasVoice || !card.word.trim()}
            title={hasVoice ? undefined : NO_VOICE}
            onClick={() => speak(card.word.trim(), 1, { start: () => setSpeaking(true), end: () => setSpeaking(false) })}
            aria-label={`Nghe phát âm từ ${label}`}
            className={cn(
              "size-9 shrink-0 rounded-full border-green-200 bg-green-50/70 text-green-700 hover:bg-green-100 hover:text-green-800",
              speaking && "bg-green-500 text-white hover:bg-green-600 hover:text-white",
            )}
          >
            <Volume2 className="size-4" />
          </Button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !isValidWord(card.word)}
            onClick={onRewrite}
            className="h-9 gap-1.5 rounded-xl border-violet-200 bg-violet-50/60 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            <Sparkles className={cn("size-3.5", writing && "animate-spin")} />
            Viết lại
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onDelete} aria-label={`Xóa từ ${label}`} className="size-9 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-1.5 pl-1">
        <Label htmlFor={`def-${card.id}`} className="text-xs font-semibold text-slate-500">
          Giải thích (tiếng Anh)
        </Label>
        {writing ? (
          <div className="flex h-16 items-center gap-2 rounded-xl bg-violet-50 px-3 text-sm font-medium text-violet-700" aria-live="polite">
            <Sparkles className="size-4 animate-spin" />
            AI đang viết…
          </div>
        ) : (
          <Textarea
            id={`def-${card.id}`}
            rows={2}
            value={card.definition}
            maxLength={MAX_EXPLANATION}
            onChange={(e) => onChange({ definition: e.target.value })}
            placeholder="A short, child-friendly explanation…"
            lang="en"
            className="min-h-16 resize-y rounded-xl border-slate-200 bg-slate-50/60 text-base leading-relaxed text-slate-800 focus-visible:bg-white"
          />
        )}
      </div>
    </Card>
  )
}
