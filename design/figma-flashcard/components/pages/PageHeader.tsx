import { CalendarDays } from 'lucide-react'
import { formatVietnameseDate } from '@/lib/format'
import { TODAY } from '@/data/mock-data'

interface PageHeaderProps {
  title: string
  description: string
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">{title}</h1>
        <p className="text-slate-500 md:mt-1.5">{description}</p>
      </div>
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600">
        <CalendarDays className="size-4 text-indigo-600" />
        {formatVietnameseDate(TODAY)}
      </div>
    </div>
  )
}
