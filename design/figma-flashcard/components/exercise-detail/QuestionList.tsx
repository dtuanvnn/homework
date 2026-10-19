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
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Question } from '@/lib/types'
import QuestionCard from './QuestionCard'

interface QuestionListProps {
  questions: Question[]
  onReorder: (questions: Question[]) => void
  onEdit: (question: Question) => void
  onDelete: (question: Question) => void
}

export default function QuestionList({ questions, onReorder, onEdit, onDelete }: QuestionListProps) {
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
    onReorder(arrayMove(questions, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
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
          {questions.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={i} onEdit={() => onEdit(q)} onDelete={() => onDelete(q)} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
