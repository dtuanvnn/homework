import { useId } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { groupBlocks } from '@/lib/question-groups'
import { applyDrop, canRelease, createGroup, joinGroup, releaseQuestion, ungroup } from '@/lib/question-groups-edit'
import { totalPoints } from '@/lib/questions'
import type { Question } from '@/lib/types'
import GroupCard from './GroupCard'
import QuestionCard, { type CardAction } from './QuestionCard'

interface QuestionListProps {
  questions: Question[]
  /** Reordering and bài changes (joining, leaving, ungrouping). */
  onChange: (questions: Question[]) => void
  onEdit: (question: Question) => void
  onDelete: (question: Question) => void
  /** "Sửa bài": also opened right after a new bài is formed. Without it, no bài actions are offered. */
  onEditGroup?: (groupId: string, questions: Question[]) => void
  onDeleteGroup?: (groupId: string) => void
  /** "Giải câu này" with AI; omitted where solving isn't offered. */
  onSolve?: (question: Question) => void
  /** Questions being solved right now. */
  solving?: ReadonlySet<string>
}

export default function QuestionList({ questions, onChange, onEdit, onDelete, onEditGroup, onDeleteGroup, onSolve, solving }: QuestionListProps) {
  // Stable id so dnd-kit's aria-describedby matches between server and client render.
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const position = (id: string | number) => questions.findIndex((q) => q.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã chọn câu ${position(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Di chuyển tới vị trí ${position(over.id)}.` : undefined),
    onDragEnd: ({ over }) => (over ? `Đã đặt vào vị trí ${position(over.id)}.` : 'Đã hủy di chuyển.'),
    onDragCancel: () => 'Đã hủy di chuyển.',
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = questions.findIndex((q) => q.id === active.id)
    const to = questions.findIndex((q) => q.id === over.id)
    onChange(applyDrop(arrayMove(questions, from, to), String(active.id)))
  }

  /** Applies a change that may form a new bài; a new, empty bài opens "Sửa bài". */
  const changeAndEdit = (next: Question[], questionId: string) => {
    onChange(next)
    const group = next.find((q) => q.id === questionId)?.group
    if (group && !group.prompt && !group.image && !group.label) onEditGroup?.(group.id, next)
  }

  const actionsFor = (q: Question, i: number): CardAction[] => {
    if (!onEditGroup) return []
    if (q.group) {
      const releasable = canRelease(questions, q.id)
      return [
        {
          label: 'Tách khỏi bài',
          onSelect: () => onChange(releaseQuestion(questions, q.id)),
          disabled: !releasable,
          hint: 'Kéo câu ra khỏi bài trước',
        },
      ]
    }
    return [
      { label: 'Tạo bài từ câu này', onSelect: () => changeAndEdit(createGroup(questions, q.id), q.id) },
      ...(i > 0 ? [{ label: 'Đưa vào bài trên', onSelect: () => changeAndEdit(joinGroup(questions, q.id, 'up'), q.id) }] : []),
      ...(i < questions.length - 1 ? [{ label: 'Đưa vào bài dưới', onSelect: () => changeAndEdit(joinGroup(questions, q.id, 'down'), q.id) }] : []),
    ]
  }

  const card = (q: Question, i: number) => (
    <QuestionCard
      key={q.id}
      question={q}
      index={i}
      onEdit={() => onEdit(q)}
      onDelete={() => onDelete(q)}
      onSolve={onSolve && (() => onSolve(q))}
      solving={solving?.has(q.id)}
      actions={actionsFor(q, i)}
    />
  )

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Nhấn phím cách để nhấc câu hỏi, dùng phím mũi tên để di chuyển, nhấn phím cách lần nữa để thả.',
        },
      }}
    >
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <ol className="relative flex flex-col gap-3">
          {groupBlocks(questions).map((block) =>
            block.kind === 'single' ? (
              card(block.item, block.number - 1)
            ) : (
              <GroupCard
                key={block.group.id}
                group={block.group}
                title={block.title}
                count={block.items.length}
                points={totalPoints(block.items.map((x) => x.item))}
                onEdit={() => onEditGroup?.(block.group.id, questions)}
                onUngroup={() => onChange(ungroup(questions, block.group.id))}
                onDelete={() => onDeleteGroup?.(block.group.id)}
              >
                {block.items.map((x) => card(x.item, x.number - 1))}
              </GroupCard>
            ),
          )}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
