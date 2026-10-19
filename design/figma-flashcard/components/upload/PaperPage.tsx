import { BLANK, OPTION_LETTERS } from '@/lib/questions'
import { SUBJECTS } from '@/lib/subjects'
import type { Question, SubjectId } from '@/lib/types'

interface PaperPageProps {
  subject: SubjectId
  grade: number
  pageNo: number
  fileName: string
  questions: { number: number; question: Question }[]
}

/** Simulated rendering of a printed PDF page (PDF rasterising is out of scope for the prototype). */
export default function PaperPage({ subject, grade, pageNo, fileName, questions }: PaperPageProps) {
  return (
    <div className="@container aspect-[210/297] w-full bg-white font-serif text-slate-800 shadow-md">
      <div className="flex h-full flex-col px-[8cqw] py-[7cqw]">
        <div className="flex items-start justify-between border-b border-slate-300 pb-[2.5cqw] text-[2.4cqw] text-slate-500">
          <span>Trường Tiểu học Nguyễn Du</span>
          <span>{fileName} · Trang {pageNo}</span>
        </div>
        <h3 className="mt-[4cqw] text-center text-[4.2cqw] font-bold tracking-wide uppercase">
          Phiếu bài tập – {SUBJECTS[subject].name} {grade}
        </h3>
        <p className="mt-[1cqw] text-center text-[2.6cqw] text-slate-500 italic">Họ và tên: ……………………… Lớp: ……</p>
        <ol className="mt-[5cqw] flex flex-col gap-[4cqw] text-[3.1cqw] leading-[1.55]">
          {questions.map(({ number, question: q }) => (
            <li key={q.id}>
              <span className="font-bold">Câu {number}. </span>
              {q.prompt.split(BLANK).join('……………')}
              {q.type === 'trac-nghiem' && (
                <div className="mt-[1cqw] grid grid-cols-2 gap-x-[4cqw] pl-[4cqw]">
                  {q.options.map((o, i) => (
                    <span key={i}>
                      {OPTION_LETTERS[i]}. {o}
                    </span>
                  ))}
                </div>
              )}
              {q.type === 'noi' && (
                <div className="mt-[1cqw] grid grid-cols-2 gap-x-[6cqw] pl-[4cqw]">
                  {q.pairs.map((p, i) => (
                    <span key={i} className="col-span-2 grid grid-cols-2">
                      <span>• {p.left}</span>
                      <span>• {q.pairs[(i + 1) % q.pairs.length].right}</span>
                    </span>
                  ))}
                </div>
              )}
              {q.type === 'sap-xep' && <div className="mt-[1cqw] pl-[4cqw]">{q.shuffled.map((i) => q.tokens[i]).join(' / ')}</div>}
              {(q.type === 'tra-loi-ngan' || q.type === 'tu-luan') && (
                <div className="mt-[1.5cqw] flex flex-col gap-[2.5cqw] pl-[4cqw]">
                  {Array.from({ length: q.type === 'tu-luan' ? 4 : 1 }, (_, i) => (
                    <span key={i} className="block border-b border-dotted border-slate-400 pt-[2cqw]" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
