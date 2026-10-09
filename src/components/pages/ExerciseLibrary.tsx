import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import AddExerciseMenu from "@/components/library/AddExerciseMenu"
import ExerciseCard, {
  type ExerciseCardActions,
} from "@/components/library/ExerciseCard"
import LibraryEmptyState from "@/components/library/LibraryEmptyState"
import LibraryFilterBar from "@/components/library/LibraryFilterBar"
import { useStudent } from "@/components/layout/AppFrame"
import { useLibrary } from "@/state/library-store"
import { formatVietnameseDate } from "@/lib/format"
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterExerciseSets,
  type LibraryFilters,
} from "@/lib/library"
import type { ExerciseSource } from "@/lib/types"

interface ExerciseLibraryProps {
  onOpenSet: (id: string) => void
  onUpload: () => void
  onGenerate: () => void
}

export default function ExerciseLibrary({
  onOpenSet,
  onUpload,
  onGenerate,
}: ExerciseLibraryProps) {
  const library = useLibrary()
  const student = useStudent()
  const sets = library.sets
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)

  const results = useMemo(
    () => filterExerciseSets(sets, filters, query),
    [sets, filters, query],
  )
  const draftCount = sets.filter((s) => s.status === "nhap").length
  const isFiltering = countActiveFilters(filters) > 0 || query.trim() !== ""

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setQuery("")
  }

  const handleAdd = async (source: ExerciseSource) => {
    if (source === "thu-cong") {
      if (creating) return
      setCreating(true)
      try {
        onOpenSet((await library.createSet()).id)
      } catch {
        toast.error("Không tạo được bộ bài", { description: "Vui lòng thử lại." })
      } finally {
        setCreating(false)
      }
      return
    }
    if (source === "tai-len") {
      onUpload()
      return
    }
    onGenerate()
  }

  const actions: ExerciseCardActions = {
    onOpen: (set) => onOpenSet(set.id),
    onEdit: (set) => onOpenSet(set.id),
    onAssign: async (set) => {
      const assignment = await library.assignSet(set.id)
      if (!assignment) return
      toast.success(`Đã giao bài cho ${student.name}`, {
        description: `“${set.title}” · Hạn ${formatVietnameseDate(assignment.dueDate)}`,
      })
    },
    onDuplicate: async (set) => {
      if (!(await library.duplicateSet(set.id))) return
      toast.success("Đã nhân bản bài tập", {
        description: "Bản sao được lưu ở dạng Nháp.",
      })
    },
    onDelete: (set) => {
      const restore = library.deleteSet(set.id)
      toast(`Đã xóa “${set.title}”`, {
        action: { label: "Hoàn tác", onClick: restore },
      })
    },
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="hidden text-3xl font-bold tracking-tight text-slate-900 md:block">
            Kho bài tập
          </h1>
          <p className="text-slate-500 md:mt-1.5">
            {sets.length} bộ bài tập · {draftCount} bản nháp
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bài tập…"
              aria-label="Tìm bài tập"
              className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <AddExerciseMenu onSelect={handleAdd} />
        </div>
      </header>

      <LibraryFilterBar
        filters={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {results.length > 0 && (
        <p className="-mb-1 text-sm text-slate-500" aria-live="polite">
          {isFiltering
            ? `Tìm thấy ${results.length} bài tập`
            : `Tất cả ${results.length} bài tập`}
        </p>
      )}

      {results.length === 0 ? (
        <LibraryEmptyState
          filtered={sets.length > 0 && isFiltering}
          onAdd={handleAdd}
          onReset={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((set) => (
            <ExerciseCard key={set.id} set={set} actions={actions} />
          ))}
        </div>
      )}
    </div>
  )
}
