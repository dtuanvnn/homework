import { Star } from 'lucide-react'
import { formatVietnameseDate } from '@/lib/format'
import { TODAY, openAssignmentsCount, student } from '@/data/mock-data'

const STICKERS = ['🦄', '🚀', '🌈', '🏆', '🐬']

export default function StudentGreeting() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-6 text-white shadow-lg shadow-indigo-600/20 md:p-8">
      <div className="pointer-events-none absolute -top-12 -right-10 size-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 right-24 size-36 rounded-full bg-white/10" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-100">{formatVietnameseDate(TODAY)}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Chào {student.name}! 👋</h1>
          <p className="mt-2 text-indigo-50">
            Hôm nay em có <strong className="font-bold text-white">{openAssignmentsCount} bài</strong> cần làm. Cố lên nhé!
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
            <Star className="size-6 fill-amber-300 text-amber-300" />
            <span className="text-2xl font-extrabold">{student.totalStars}</span>
            <span className="text-sm text-indigo-100">ngôi sao</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label="Nhãn dán của em">
            {STICKERS.map((s, i) => (
              <span
                key={s}
                className="flex size-10 items-center justify-center rounded-full bg-white text-xl shadow-sm"
                style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 6}deg)` }}
                aria-hidden
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
