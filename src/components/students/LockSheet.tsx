"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { unwrap } from "@/lib/action-result"
import type { LockChoice } from "@/lib/student-lock"
import { lockStudent } from "@/server/actions/students"

type Option = "1h" | "today" | "manual" | "at"

export default function LockSheet({ studentId, name, onOpenChange }: { studentId: string; name: string; onOpenChange: (open: boolean) => void }) {
  const [option, setOption] = useState<Option>("manual")
  const [at, setAt] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const choice: LockChoice = option === "at" ? { at: new Date(at).toISOString() } : option
      unwrap(await lockStudent({ id: studentId, choice, reason: reason || undefined }))
      toast.success(`Đã khoá tài khoản ${name}`)
      onOpenChange(false)
    } catch (e) {
      toast.error("Chưa khoá được", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Khoá tài khoản {name}</SheetTitle>
          <SheetDescription>Bé vẫn được giao bài; bài có giờ đang làm vẫn tính giờ và tự nộp khi hết giờ.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 md:px-6">
          <div>
            <Label>Khoá trong</Label>
            <ToggleGroup type="single" value={option} onValueChange={(v) => v && setOption(v as Option)} className="mt-2 flex-wrap justify-start">
              <ToggleGroupItem value="1h">1 giờ</ToggleGroupItem>
              <ToggleGroupItem value="today">Đến hết hôm nay</ToggleGroupItem>
              <ToggleGroupItem value="manual">Đến khi mở</ToggleGroupItem>
              <ToggleGroupItem value="at">Chọn giờ…</ToggleGroupItem>
            </ToggleGroup>
            {option === "at" && <Input className="mt-2" type="datetime-local" aria-label="Mở khoá lúc" value={at} onChange={(e) => setAt(e.target.value)} />}
          </div>
          <div>
            <Label htmlFor="lock-reason">Lời nhắn</Label>
            <Input id="lock-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Không bắt buộc" maxLength={120} />
          </div>
        </div>
        <SheetFooter className="flex-col">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button className="flex-[2]" onClick={save} disabled={busy || (option === "at" && !at)}>
              {busy && <Loader2 className="animate-spin" />}
              Khoá
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
