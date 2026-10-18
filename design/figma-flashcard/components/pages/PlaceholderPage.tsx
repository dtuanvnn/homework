import { Card } from '@/components/ui/card'
import { SUBJECT_LIST } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/lib/types'
import type { NavItem } from '@/components/layout/nav-config'
import PageHeader from './PageHeader'
import StudentGreeting from './StudentGreeting'

interface PlaceholderPageProps {
  item: NavItem
  mode: AppMode
}

export default function PlaceholderPage({ item, mode }: PlaceholderPageProps) {
  const isStudent = mode === 'student'
  const Icon = item.icon

  return (
    <div className="flex flex-col gap-6">
      {isStudent && item.id === 'today' ? (
        <StudentGreeting />
      ) : (
        <PageHeader title={item.label} description={item.description} />
      )}

      <Card
        className={cn(
          'items-center gap-3 border-2 border-dashed border-slate-200 bg-white/60 py-12 text-center shadow-none',
          isStudent && 'rounded-3xl',
        )}
      >
        <div
          className={cn(
            'flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600',
            isStudent && 'size-16 rounded-3xl',
          )}
        >
          <Icon className="size-7" />
        </div>
        <div>
          <h2 className={cn('text-lg font-semibold text-slate-900', isStudent && 'text-xl')}>{item.label}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Màn hình này đang được thiết kế. Nội dung sẽ được bổ sung ở bước tiếp theo.
          </p>
        </div>
      </Card>

      {/* Layout preview: demonstrates the responsive 1 / 2 / 3 column grid and subject accents. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {SUBJECT_LIST.map((subject) => {
          const SubjectIcon = subject.icon
          return (
            <Card key={subject.id} className={cn('relative gap-3 overflow-hidden', isStudent && 'rounded-3xl p-6')}>
              <div className={cn('absolute inset-y-0 left-0 w-1.5', subject.bg)} />
              <div className="flex items-center gap-3">
                <div className={cn('flex size-10 items-center justify-center rounded-xl', subject.softBg, subject.text)}>
                  <SubjectIcon className="size-5" />
                </div>
                <span className={cn('text-sm font-semibold', subject.text)}>{subject.name}</span>
              </div>
              <div className="h-3 w-3/4 rounded-full bg-slate-100" />
              <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
