import { createPortal } from "react-dom"
import { useEffect } from "react"
import { CardTitle } from "@/components/ui/card"
import { useStudent } from "@/components/layout/AppFrame"
import { OPTION_LETTERS } from "@/lib/questions"
import type { ExerciseSet, Question } from "@/lib/types"

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
  const student = useStudent()
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
        {questions.map((q, i) => (
          <li key={q.id} className="break-inside-avoid">
            <p className="font-semibold whitespace-pre-line">
              Câu {i + 1}. {q.prompt}
            </p>
            {q.type === "trac-nghiem" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {q.options.map((opt, index) => (
                  <p key={index}>
                    {OPTION_LETTERS[index]}. {opt}
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
                      {index + 1}. {p.left}
                    </p>
                  ))}
                </div>
                <div>
                  {[...q.pairs].reverse().map((p, index) => (
                    <p key={index}>
                      {OPTION_LETTERS[index]}. {p.right}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {q.type === "sap-xep" && (
              <p className="mt-2">
                {q.shuffled.map((index) => q.tokens[index]).join(" / ")}
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
        ))}
      </ol>
    </div>,
    document.body,
  )
}
