import { createPortal } from "react-dom"
import { useEffect } from "react"
import { CardTitle } from "@/components/ui/card"
import { useRequiredStudent } from "@/components/layout/AppFrame"
import { groupBlocks } from "@/lib/question-groups"
import { OPTION_LETTERS } from "@/lib/questions"
import { isMultiAnswer } from "@/lib/choice"
import type { ExerciseSet, Question } from "@/lib/types"
import Passage from "@/components/question/Passage"
import RichText from "@/components/question/RichText"
import QuestionPicture from "@/components/question/QuestionPicture"

/** A student worksheet: deliberately omits answers and grading rubrics. */
export default function PrintableExercise({
  set,
  questions,
  note,
  onDone,
}: {
  set: ExerciseSet
  questions: Question[]
  note?: string
  onDone: () => void
}) {
  const student = useRequiredStudent()
  const groupTitles = new Map(groupBlocks(questions).flatMap((b) => (b.kind === "group" ? [[b.group.id, b.title] as const] : [])))
  // Split passages: blank index → câu number, per bài. The passage prints once with its numbered blanks.
  const blankNumbers = new Map<string, Map<number, number>>()
  questions.forEach((q, i) => {
    if (q.type !== "tra-loi-ngan" || !q.blank || !q.group) return
    const numbers = blankNumbers.get(q.group.id) ?? new Map<number, number>()
    numbers.set(q.blank, i + 1)
    blankNumbers.set(q.group.id, numbers)
  })
  const groupHeader = (group: NonNullable<Question["group"]>) => {
    const numbers = blankNumbers.get(group.id)
    return (
      <div className="mb-4 space-y-2">
        <p className="text-lg font-bold">{groupTitles.get(group.id)}</p>
        <Passage
          group={group}
          pictureClassName="max-h-64"
          renderPieces={
            numbers
              ? (pieces) =>
                  pieces.map((piece, k) =>
                    piece.kind === "blank" ? (
                      <span key={k}>({numbers.get(piece.index) ?? "?"}) ……………</span>
                    ) : piece.bold ? (
                      <strong key={k}><RichText text={piece.text} /></strong>
                    ) : (
                      <RichText key={k} text={piece.text} />
                    ),
                  )
              : undefined
          }
        />
      </div>
    )
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.print()
      onDone()
    })
    return () => cancelAnimationFrame(frame)
  }, [onDone])
  return createPortal(
    <div id="homework-print" className="hidden bg-white p-8 text-slate-900">
      <CardTitle className="text-2xl">{set.title}</CardTitle>
      <p className="mt-3">Họ và tên: {student.name} · Lớp {set.grade} · Ngày: ……………</p>
      {note && <p className="mt-3">Ghi chú: {note}</p>}
      <ol className="mt-6 space-y-6">
        {questions.map((q, i) => {
          const firstOfBai = !!q.group && questions[i - 1]?.group?.id !== q.group.id
          // A blank câu is written into the passage: no line of its own.
          if (q.type === "tra-loi-ngan" && q.blank && q.group) {
            return firstOfBai ? <li key={q.id} className="break-inside-avoid">{groupHeader(q.group)}</li> : null
          }
          return (
          <li key={q.id} className="break-inside-avoid">
            {q.group && firstOfBai && groupHeader(q.group)}
            <p className="font-semibold whitespace-pre-line">
              Câu {i + 1}. <RichText text={q.prompt} />
            </p>
            <QuestionPicture question={q} className="max-h-64" />
            {q.type === "trac-nghiem" && isMultiAnswer(q) && (
              <p className="mt-1 text-sm italic">(Chọn tất cả đáp án đúng)</p>
            )}
            {q.type === "trac-nghiem" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {q.options.map((opt, index) => (
                  <p key={index}>
                    {OPTION_LETTERS[index]}. <RichText text={opt} />
                  </p>
                ))}
              </div>
            )}
            {q.type === "dung-sai" && (
              <p className="mt-2">□ Đúng &nbsp; □ Sai</p>
            )}
            {q.type === "noi" && (
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  {q.pairs.map((p, index) => (
                    <p key={index}>
                      {index + 1}. <RichText text={p.left} />
                    </p>
                  ))}
                </div>
                <div>
                  {[...q.pairs].reverse().map((p, index) => (
                    <p key={index}>
                      {OPTION_LETTERS[index]}. <RichText text={p.right} />
                    </p>
                  ))}
                </div>
              </div>
            )}
            {q.type === "sap-xep" && (
              <p className="mt-2">
                <RichText text={q.shuffled.map((index) => q.tokens[index]).join(" / ")} />
              </p>
            )}
            {q.type !== "trac-nghiem" &&
              q.type !== "dung-sai" &&
              q.type !== "dien-cho-trong" && (
                <div className="mt-4 space-y-5">
                  {Array.from(
                    { length: q.type === "tu-luan" ? 4 : 1 },
                    (_, index) => (
                      <div
                        key={index}
                        className="border-b border-dotted border-slate-400"
                      />
                    ),
                  )}
                </div>
              )}
          </li>
          )
        })}
      </ol>
    </div>,
    document.body,
  )
}
