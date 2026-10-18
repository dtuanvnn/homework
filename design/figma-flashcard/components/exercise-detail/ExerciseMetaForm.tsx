import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EXERCISE_KINDS, GRADES } from '@/lib/library'
import { SUBJECT_LIST } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import type { Attachment, ExerciseKind, ExerciseSet, SubjectId } from '@/lib/types'
import AttachmentGallery from './AttachmentGallery'
import DifficultyStars from './DifficultyStars'

interface ExerciseMetaFormProps {
  value: ExerciseSet
  onChange: (patch: Partial<ExerciseSet>) => void
  attachments: Attachment[]
  onAttachmentsChange: (attachments: Attachment[]) => void
  titleError?: boolean
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export default function ExerciseMetaForm({ value, onChange, attachments, onAttachmentsChange, titleError }: ExerciseMetaFormProps) {
  return (
    <Card className="gap-5 p-4 md:p-6">
      <Field label="Tên bộ bài" htmlFor="set-title">
        <Input
          id="set-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="VD: Phép chia có dư – Luyện tập"
          aria-invalid={titleError || undefined}
          className={cn('h-12 text-base font-semibold md:text-base', titleError && 'border-red-400 focus-visible:ring-red-500/20')}
        />
        {titleError && <p className="text-xs font-medium text-red-600">Hãy đặt tên cho bộ bài.</p>}
      </Field>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Môn">
          <Select value={value.subject} onValueChange={(v) => onChange({ subject: v as SubjectId })}>
            <SelectTrigger aria-label="Môn" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_LIST.map((s) => {
                const Icon = s.icon
                return (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <Icon className={cn('size-4', s.text)} />
                      {s.name}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Lớp">
          <Select value={String(value.grade)} onValueChange={(v) => onChange({ grade: Number(v) })}>
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
        </Field>
        <Field label="Loại" className="col-span-2 md:col-span-1">
          <Select value={value.kind} onValueChange={(v) => onChange({ kind: v as ExerciseKind })}>
            <SelectTrigger aria-label="Loại" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EXERCISE_KINDS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Chủ đề" htmlFor="set-topic">
          <Input
            id="set-topic"
            value={value.topic}
            onChange={(e) => onChange({ topic: e.target.value })}
            placeholder="VD: Phép chia có dư"
          />
        </Field>
        <Field label="Độ khó">
          <DifficultyStars value={value.difficulty} onChange={(difficulty) => onChange({ difficulty })} />
        </Field>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-5">
        <div className="flex items-baseline justify-between gap-2">
          <Label>Tệp nguồn</Label>
          <span className="text-xs text-slate-400">{attachments.length} tệp</span>
        </div>
        <AttachmentGallery attachments={attachments} onChange={onAttachmentsChange} />
      </div>
    </Card>
  )
}
