import { useEffect, useMemo, useRef, useState } from "react"
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
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  CheckCircle2,
  GripVertical,
  Languages,
  Layers,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AssignSheet from "@/components/schedule/AssignSheet"
import { TODAY } from "@/data/mock-data"
import {
  UNIT_3_SAMPLE_WORDS,
  createFlashcardItem,
  generateChildFriendlyDefinition,
  parseWordList,
  speakEnglishWord,
} from "@/lib/flashcards"
import { GRADES } from "@/lib/library"
import { uid } from "@/lib/questions"
import { cn } from "@/lib/utils"
import { useLibrary } from "@/state/library-store"
import type {
  ExerciseSet,
  ExerciseSetStatus,
  FlashcardItem,
} from "@/lib/types"
import type { LeaveGuard } from "./ExerciseSetDetail"

interface FlashcardBuilderProps {
  /** Optional existing flashcard set ID when editing from the library. */
  setId?: string | null
  onClose: () => void
  registerLeaveGuard: (guard: LeaveGuard | null) => void
}

interface WordCardProps {
  card: FlashcardItem
  index: number
  regenerating: boolean
  speaking: boolean
  onChangeWord: (value: string) => void
  onChangeDefinition: (value: string) => void
  onRegenerate: () => void
  onSpeak: () => void
  onDelete: () => void
}

function SortableWordCard({
  card,
  index,
  regenerating,
  speaking,
  onChangeWord,
  onChangeDefinition,
  onRegenerate,
  onSpeak,
  onDelete,
}: WordCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative gap-3.5 border-slate-200/80 bg-white p-4 transition-shadow md:p-5",
        isDragging && "z-20 border-green-300 shadow-xl ring-2 ring-green-500/20",
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Kéo để đổi thứ tự từ ${card.word}`}
          className={cn(
            "-ml-2 size-10 touch-none rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-600",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="size-5" />
        </Button>

        <Badge
          variant="secondary"
          className="h-7 min-w-7 justify-center rounded-full bg-green-500 px-2 text-xs font-bold text-white"
        >
          {index + 1}
        </Badge>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={card.word}
            onChange={(e) => onChangeWord(e.target.value)}
            aria-label={`Từ vựng ${index + 1}`}
            className="h-10 border-transparent bg-transparent px-2 text-xl font-bold tracking-tight text-slate-900 shadow-none hover:border-slate-200 focus-visible:border-green-500 focus-visible:bg-white md:text-2xl"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onSpeak}
            aria-label={`Nghe phát âm từ ${card.word}`}
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
            disabled={regenerating}
            onClick={onRegenerate}
            className="h-9 gap-1.5 rounded-xl border-violet-200 bg-violet-50/60 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            <Sparkles className={cn("size-3.5", regenerating && "animate-spin")} />
            Viết lại
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={`Xóa từ ${card.word}`}
            className="size-9 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 pl-1">
        <Label
          htmlFor={`def-${card.id}`}
          className="text-xs font-semibold text-slate-500"
        >
          Giải thích (tiếng Anh)
        </Label>
        <Textarea
          id={`def-${card.id}`}
          rows={2}
          value={card.definition}
          onChange={(e) => onChangeDefinition(e.target.value)}
          placeholder="Short, child-friendly English definition..."
          className="min-h-16 resize-y rounded-xl border-slate-200 bg-slate-50/60 text-base leading-relaxed text-slate-800 focus-visible:bg-white"
        />
      </div>
    </Card>
  )
}

function WordCardSkeleton({ word, index }: { word: string; index: number }) {
  return (
    <Card className="gap-3.5 border-dashed border-green-200 bg-white/80 p-4 md:p-5">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-lg bg-slate-100" />
        <Badge
          variant="secondary"
          className="h-7 min-w-7 justify-center rounded-full bg-green-100 px-2 text-xs font-bold text-green-700"
        >
          {index + 1}
        </Badge>
        <span className="text-xl font-bold tracking-tight text-slate-700 md:text-2xl">
          {word}
        </span>
        <Badge
          variant="outline"
          className="ml-auto border-violet-200 bg-violet-50 text-violet-700"
        >
          <Sparkles className="size-3 animate-spin" />
          AI đang viết…
        </Badge>
      </div>
      <div className="space-y-2 pl-1">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </Card>
  )
}

export default function FlashcardBuilder({
  setId,
  onClose,
  registerLeaveGuard,
}: FlashcardBuilderProps) {
  const library = useLibrary()
  const existingSet = setId ? library.getSet(setId) : undefined
  const existingCards = useMemo(
    () => (setId ? library.getFlashcards(setId) : []),
    [setId, library],
  )

  const [currentId] = useState(() => existingSet?.id ?? uid("bt-fc"))
  const [title, setTitle] = useState(
    () => existingSet?.title ?? "Unit 3 – Từ mới",
  )
  const [book, setBook] = useState(
    () => existingSet?.book ?? "Oxford Discovery 2",
  )
  const [unit, setUnit] = useState<number>(() => existingSet?.unit ?? 3)
  const [topic, setTopic] = useState(
    () => existingSet?.topic ?? "Where Do Animals Live?",
  )
  const [grade, setGrade] = useState<number>(() => existingSet?.grade ?? 3)
  const [rawWords, setRawWords] = useState(() =>
    existingCards.length > 0
      ? existingCards.map((c) => c.word).join("\n")
      : UNIT_3_SAMPLE_WORDS.join("\n"),
  )
  const [cards, setCards] = useState<FlashcardItem[]>(() =>
    existingCards.length > 0
      ? existingCards
      : UNIT_3_SAMPLE_WORDS.map((w) =>
          createFlashcardItem(w, 0, "Where Do Animals Live?"),
        ),
  )
  const [variantsByWord, setVariantsByWord] = useState<Record<string, number>>(
    {},
  )
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [aiWriting, setAiWriting] = useState<{
    current: number
    total: number
    words: string[]
  } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)

  const parsed = useMemo(() => parseWordList(rawWords), [rawWords])

  useEffect(() => {
    registerLeaveGuard((next) => (dirty ? setPendingLeave(() => next) : next()))
    return () => registerLeaveGuard(null)
  }, [dirty, registerLeaveGuard])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const position = (id: string | number) =>
    cards.findIndex((c) => c.id === id) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã chọn thẻ từ vị trí ${position(active.id)}.`,
    onDragOver: ({ over }) =>
      over ? `Di chuyển tới vị trí ${position(over.id)}.` : undefined,
    onDragEnd: ({ over }) =>
      over
        ? `Đã đặt thẻ từ vào vị trí ${position(over.id)}.`
        : "Đã hủy sắp xếp.",
    onDragCancel: () => "Đã hủy sắp xếp.",
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = cards.findIndex((c) => c.id === active.id)
    const to = cards.findIndex((c) => c.id === over.id)
    setCards(arrayMove(cards, from, to))
    setDirty(true)
  }

  const handleGenerateDefinitions = () => {
    if (parsed.words.length === 0) {
      toast.error("Hãy nhập ít nhất 1 từ vựng tiếng Anh trước khi tạo giải thích.")
      return
    }
    if (timerRef.current) window.clearInterval(timerRef.current)

    const targetWords = parsed.words
    const total = targetWords.length
    setCards([])
    setAiWriting({ current: 1, total, words: targetWords })
    setDirty(true)

    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 80)

    let step = 0
    timerRef.current = window.setInterval(() => {
      step += 1
      const nextCards = targetWords.slice(0, step).map((word) => {
        const key = word.toLowerCase()
        const variant = variantsByWord[key] ?? 0
        return createFlashcardItem(word, variant, topic)
      })
      setCards(nextCards)

      if (step >= total) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = null
        setAiWriting(null)
        toast.success(`AI đã viết xong giải thích cho ${total} từ vựng!`)
      } else {
        setAiWriting({ current: step + 1, total, words: targetWords })
      }
    }, 140)
  }

  const handleRegenerateCard = (card: FlashcardItem) => {
    setRegeneratingId(card.id)
    const key = card.word.trim().toLowerCase()
    const nextVariant = (variantsByWord[key] ?? 0) + 1
    setVariantsByWord((prev) => ({ ...prev, [key]: nextVariant }))

    window.setTimeout(() => {
      const newDef = generateChildFriendlyDefinition(
        card.word,
        nextVariant,
        topic,
      )
      setCards((prev) =>
        prev.map((item) =>
          item.id === card.id ? { ...item, definition: newDef } : item,
        ),
      )
      setRegeneratingId(null)
      setDirty(true)
      toast.success(`Đã viết lại giải thích cho "${card.word}"`)
    }, 220)
  }

  const handleSpeakCard = (card: FlashcardItem) => {
    setSpeakingId(card.id)
    const ok = speakEnglishWord(card.word)
    if (!ok) {
      toast.message(`Phát âm: ${card.word}`, {
        description: "Trình duyệt hiện tại không hỗ trợ Web Speech API.",
      })
    }
    window.setTimeout(() => {
      setSpeakingId((prev) => (prev === card.id ? null : prev))
    }, 700)
  }

  const handleDeleteCard = (card: FlashcardItem, index: number) => {
    setCards((prev) => prev.filter((item) => item.id !== card.id))
    setDirty(true)
    toast(`Đã xóa từ "${card.word}"`, {
      action: {
        label: "Hoàn tác",
        onClick: () => {
          setCards((prev) =>
            prev.some((x) => x.id === card.id)
              ? prev
              : [...prev.slice(0, index), card, ...prev.slice(index)],
          )
        },
      },
    })
  }

  const handleAddBlankCard = () => {
    const newCard: FlashcardItem = {
      id: uid("fc"),
      word: "new word",
      definition: generateChildFriendlyDefinition("new word", 0, topic),
    }
    setCards((prev) => [...prev, newCard])
    setDirty(true)
  }

  const buildExerciseSet = (status: ExerciseSetStatus): ExerciseSet => {
    const cleanBook = book.trim() || "Oxford Discovery 2"
    const cleanTopic = topic.trim() || `Unit ${unit}`
    return {
      id: currentId,
      title: title.trim(),
      subject: "tieng-anh",
      grade,
      topic: cleanTopic,
      description: `${cleanBook} · Unit ${unit}: ${cleanTopic} · ${cards.length} từ vựng tiếng Anh.`,
      questionCount: cards.length,
      estimatedMinutes: Math.max(5, Math.ceil(cards.length * 0.8)),
      difficulty: existingSet?.difficulty ?? 2,
      kind: "chu-de",
      source: "ai",
      status,
      timesAssigned: existingSet?.timesAssigned ?? 0,
      createdAt: existingSet?.createdAt ?? TODAY.toISOString(),
      format: "flashcard",
      book: cleanBook,
      unit,
    }
  }

  const persist = (status: ExerciseSetStatus): boolean => {
    if (!title.trim()) {
      setTitleError(true)
      document.getElementById("flashcard-set-title")?.focus()
      toast.error("Vui lòng nhập tên bộ từ vựng.")
      return false
    }
    const validCards = cards.filter((c) => c.word.trim().length > 0)
    if (validCards.length === 0) {
      toast.error("Cần ít nhất 1 thẻ từ vựng trong danh sách.")
      return false
    }
    const setObj = buildExerciseSet(status)
    library.saveFlashcardSet(setObj, validCards)
    setCards(validCards)
    setDirty(false)
    return true
  }

  const handleSaveDraft = () => {
    if (persist("nhap")) {
      toast.success("Đã lưu nháp bộ từ vựng", {
        description: `“${title.trim()}” · ${cards.length} từ`,
      })
    }
  }

  const handleSaveReady = () => {
    if (persist("san-sang")) {
      toast.success("Đã lưu & sẵn sàng giao bài", {
        description: `“${title.trim()}” · ${cards.length} từ`,
      })
    }
  }

  const handleOpenAssign = () => {
    if (!persist("san-sang")) return
    setAssignSheetOpen(true)
  }

  const pendingSkeletonWords = aiWriting
    ? aiWriting.words.slice(cards.length)
    : []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28 md:gap-7 md:pb-12">
      <header className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-10 w-fit -translate-x-3 text-slate-500 md:inline-flex"
          onClick={() => (dirty ? setPendingLeave(() => onClose) : onClose())}
        >
          <ArrowLeft />
          Kho bài tập
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white shadow-sm">
              <Languages className="size-6" />
              <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-lg bg-green-600 text-white ring-2 ring-white">
                <Layers className="size-3.5" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-green-50 font-semibold text-green-700"
                >
                  <Languages className="size-3.5" />
                  Tiếng Anh
                </Badge>
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50/60 font-semibold text-green-700"
                >
                  <Layers className="size-3.5" />
                  Từ vựng (Flashcard)
                </Badge>
                {dirty && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700"
                  >
                    Chưa lưu
                  </Badge>
                )}
              </div>
              <CardTitle
                role="heading"
                aria-level={1}
                className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl"
              >
                Tạo bộ từ vựng
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Soạn thẻ từ mới theo từng Unit trong sách giáo khoa Tiếng Anh,
                giải thích hoàn toàn bằng tiếng Anh ngắn gọn cho trẻ.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Step 1: Set details & Word list input */}
      <Card className="gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">1. Thông tin bộ từ & danh sách từ</CardTitle>
            <CardDescription className="mt-0.5">
              Môn học cố định là Tiếng Anh · Định dạng Flashcard
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-green-200 bg-green-50 text-green-700"
          >
            <Layers className="size-3.5" />
            {book || "Oxford Discovery 2"} · Unit {unit}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="space-y-2 md:col-span-6">
            <Label htmlFor="flashcard-set-title">Tên bộ</Label>
            <Input
              id="flashcard-set-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (e.target.value.trim()) setTitleError(false)
                setDirty(true)
              }}
              placeholder="Unit 3 – Từ mới"
              aria-invalid={titleError}
              className={cn(titleError && "border-red-400 focus-visible:ring-red-200")}
            />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="flashcard-book">Sách</Label>
            <Input
              id="flashcard-book"
              value={book}
              onChange={(e) => {
                setBook(e.target.value)
                setDirty(true)
              }}
              placeholder="Oxford Discovery 2"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="flashcard-unit">Unit</Label>
            <Input
              id="flashcard-unit"
              type="number"
              min={1}
              max={30}
              value={unit}
              onChange={(e) => {
                const nextUnit = Math.max(1, Number(e.target.value) || 1)
                setUnit(nextUnit)
                setDirty(true)
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-8">
            <Label htmlFor="flashcard-topic">Chủ đề</Label>
            <Input
              id="flashcard-topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value)
                setDirty(true)
              }}
              placeholder="Where Do Animals Live?"
            />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Lớp</Label>
            <Select
              value={String(grade)}
              onValueChange={(v) => {
                setGrade(Number(v))
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
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="flashcard-word-list">
              Dán danh sách từ (mỗi dòng một từ)
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={() => {
                setRawWords(UNIT_3_SAMPLE_WORDS.join("\n"))
                setDirty(true)
              }}
            >
              Điền mẫu 12 từ Unit 3
            </Button>
          </div>

          <Textarea
            id="flashcard-word-list"
            rows={7}
            value={rawWords}
            onChange={(e) => {
              setRawWords(e.target.value)
              setDirty(true)
            }}
            placeholder={
              "habitat\ndesert\nrainforest\nburrow\nnest\nocean"
            }
            className="min-h-40 font-medium leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-green-50 font-semibold text-green-700"
              >
                Đã nhận {parsed.words.length} từ
              </Badge>
              <span>
                Từ trùng lặp và dòng trống được tự động loại bỏ.
              </span>
            </div>
            {(parsed.duplicateCount > 0 || parsed.blankLineCount > 0) && (
              <span className="font-medium text-amber-700">
                Đã lược bỏ{" "}
                {parsed.duplicateCount > 0
                  ? `${parsed.duplicateCount} từ trùng`
                  : ""}
                {parsed.duplicateCount > 0 && parsed.blankLineCount > 0
                  ? " · "
                  : ""}
                {parsed.blankLineCount > 0
                  ? `${parsed.blankLineCount} dòng trống`
                  : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            AI sẽ viết định nghĩa bằng tiếng Anh ngắn gọn, phù hợp học sinh tiểu học.
          </p>
          <Button
            size="lg"
            onClick={handleGenerateDefinitions}
            disabled={parsed.words.length === 0 || aiWriting !== null}
            className="w-full sm:w-auto"
          >
            <Sparkles className={cn(aiWriting && "animate-spin")} />
            AI viết giải thích
          </Button>
        </div>
      </Card>

      {/* Step 2: Review & Edit Word Cards */}
      <div ref={reviewSectionRef} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              2. Kiểm tra & chỉnh sửa thẻ từ ({cards.length} từ)
            </CardTitle>
            <CardDescription className="mt-0.5">
              Nghe thử phát âm, sửa giải thích tiếng Anh hoặc kéo tay nắm để sắp xếp thứ tự.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlankCard}
            disabled={aiWriting !== null}
          >
            <Plus className="size-4" />
            Thêm thẻ từ
          </Button>
        </div>

        {aiWriting && (
          <Card className="gap-3 border-violet-200 bg-violet-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-violet-800">
                <Sparkles className="size-4 animate-spin text-violet-600" />
                <span>
                  AI đang viết giải thích… {aiWriting.current}/{aiWriting.total}
                </span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-violet-700">
                {Math.round((aiWriting.current / aiWriting.total) * 100)}%
              </span>
            </div>
            <Progress
              value={(aiWriting.current / aiWriting.total) * 100}
              indicatorClassName="bg-violet-600"
            />
          </Card>
        )}

        {cards.length === 0 && !aiWriting ? (
          <Card className="items-center gap-3 border-dashed py-10 text-center shadow-none">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <Layers className="size-6" />
            </div>
            <CardTitle className="text-base">
              Chưa có thẻ từ vựng nào
            </CardTitle>
            <CardDescription className="max-w-sm">
              Dán danh sách từ ở khung trên và nhấn “AI viết giải thích” để tạo
              bộ thẻ từ vựng tiếng Anh.
            </CardDescription>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  "Nhấn phím cách để nhấc thẻ từ, dùng phím mũi tên để đổi vị trí, nhấn phím cách lần nữa để thả.",
              },
            }}
          >
            <SortableContext
              items={cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {cards.map((card, i) => (
                  <SortableWordCard
                    key={card.id}
                    card={card}
                    index={i}
                    regenerating={regeneratingId === card.id}
                    speaking={speakingId === card.id}
                    onChangeWord={(val) => {
                      setCards((prev) =>
                        prev.map((item) =>
                          item.id === card.id ? { ...item, word: val } : item,
                        ),
                      )
                      setDirty(true)
                    }}
                    onChangeDefinition={(val) => {
                      setCards((prev) =>
                        prev.map((item) =>
                          item.id === card.id
                            ? { ...item, definition: val }
                            : item,
                        ),
                      )
                      setDirty(true)
                    }}
                    onRegenerate={() => handleRegenerateCard(card)}
                    onSpeak={() => handleSpeakCard(card)}
                    onDelete={() => handleDeleteCard(card, i)}
                  />
                ))}

                {pendingSkeletonWords.map((word, idx) => (
                  <WordCardSkeleton
                    key={`skeleton-${word}-${idx}`}
                    word={word}
                    index={cards.length + idx}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Sticky Footer */}
      <Card className="sticky bottom-0 z-30 border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <Badge
              variant="secondary"
              className="bg-green-50 font-semibold text-green-700"
            >
              <Layers className="size-3.5" />
              {cards.length} từ
            </Badge>
            <span className="text-xs text-slate-500">
              {dirty ? "Có thay đổi chưa lưu" : "Đã sẵn sàng lưu vào kho"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenAssign}
              disabled={aiWriting !== null || cards.length === 0}
              className="col-span-2 sm:col-span-1"
            >
              <Send className="size-4" />
              Giao bài này
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={aiWriting !== null || cards.length === 0}
            >
              <Save className="size-4" />
              Lưu nháp
            </Button>
            <Button
              type="button"
              onClick={handleSaveReady}
              disabled={aiWriting !== null || cards.length === 0}
            >
              <CheckCircle2 className="size-4" />
              Lưu & sẵn sàng
            </Button>
          </div>
        </div>
      </Card>

      {assignSheetOpen && (
        <AssignSheet
          date={new Date(TODAY)}
          setId={currentId}
          onClose={() => setAssignSheetOpen(false)}
          onCreated={() => setAssignSheetOpen(false)}
        />
      )}

      <Dialog
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && setPendingLeave(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bạn có thay đổi chưa lưu</DialogTitle>
            <DialogDescription>
              Lưu nháp bộ từ vựng để giữ lại, hoặc bỏ các thay đổi vừa thực hiện.
            </DialogDescription>
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
              onClick={() => {
                const next = pendingLeave
                if (!persist("nhap")) {
                  setPendingLeave(null)
                  return
                }
                toast.success("Đã lưu nháp bộ từ vựng")
                setPendingLeave(null)
                next?.()
              }}
            >
              Lưu nháp & thoát
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
