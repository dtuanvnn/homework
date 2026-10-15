"use client"

import { Backpack, Lock, Users } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { unwrap } from "@/lib/action-result"
import type { ChildOption, Student } from "@/lib/types"
import { setViewingStudent } from "@/server/actions/students"
import { useAppNavigation } from "./AppFrame"
import { parentPaths } from "./routes"

/** Parent header: who is being viewed, switch child, manage children, open student mode. */
export default function ParentMenu({ student, household, onOpenStudentMode, compact }: {
  student: Student | null
  household: ChildOption[]
  onOpenStudentMode: () => void
  compact?: boolean
}) {
  const { navigate } = useAppNavigation()
  const choose = async (id: string) => {
    if (id === student?.id) return
    try {
      unwrap(await setViewingStudent(id))
    } catch (e) {
      toast.error("Chưa đổi được học sinh", { description: e instanceof Error ? e.message : undefined })
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={student ? `Đang xem: ${student.name}` : "Chưa có học sinh"}
        className="flex items-center gap-2 rounded-full p-1 pr-3 outline-none hover:bg-slate-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-lg" aria-hidden>
          {student?.avatarEmoji ?? "👤"}
        </span>
        {!compact && <span className="max-w-32 truncate text-sm font-semibold text-slate-800">{student?.name ?? "Chưa có học sinh"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {household.length > 1 && (
          <>
            <DropdownMenuLabel>Đang xem</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={student?.id} onValueChange={choose}>
              {household.map((c) => (
                <DropdownMenuRadioItem key={c.id} value={c.id}>
                  <span aria-hidden>{c.avatarEmoji}</span> {c.name}
                  <span className="ml-auto text-xs text-slate-500">Lớp {c.grade}</span>
                  {c.locked && <Lock className="size-3.5 text-amber-600" aria-label="Đang khoá" />}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => navigate(parentPaths.students)}>
          <Users /> Quản lý học sinh
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenStudentMode}>
          <Backpack /> Mở chế độ học sinh
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
