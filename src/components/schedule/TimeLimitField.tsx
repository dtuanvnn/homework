"use client"

import { Timer } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const PRESETS = [10, 15, 20, 30, 45, 60]

/** Default limit when the parent turns exam mode on: the set's estimate, else 20 minutes. */
export function suggestedLimit(estimatedMinutes: number | undefined): number {
  return estimatedMinutes ? Math.min(Math.max(Math.round(estimatedMinutes), 1), 240) : 20
}

/** "Giới hạn thời gian" for web work: off, a preset, or a custom number of minutes. */
export default function TimeLimitField({
  id,
  value,
  onChange,
  suggested,
  disabled,
}: {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  suggested: number
  disabled?: boolean
}) {
  const choice = value === null ? "off" : PRESETS.includes(value) ? String(value) : "custom"
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-minutes`} className="inline-flex items-center gap-1.5">
        <Timer className="size-4" />
        Giới hạn thời gian
      </Label>
      <ToggleGroup
        type="single"
        value={choice}
        onValueChange={(v) => {
          if (!v) return
          if (v === "off") onChange(null)
          else if (v === "custom") onChange(value ?? suggested)
          else onChange(Number(v))
        }}
        disabled={disabled}
        className="flex flex-wrap"
        aria-label="Giới hạn thời gian"
      >
        <ToggleGroupItem value="off">Không</ToggleGroupItem>
        {PRESETS.map((m) => (
          <ToggleGroupItem key={m} value={String(m)} aria-label={`${m} phút`}>
            {m}′
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="custom">Khác</ToggleGroupItem>
      </ToggleGroup>
      {value !== null && (
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-minutes`}
            type="number"
            inputMode="numeric"
            min={1}
            max={240}
            className="w-24"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n)) onChange(Math.min(Math.max(n, 1), 240))
            }}
          />
          <span className="text-sm text-slate-600">phút mỗi lần làm</span>
        </div>
      )}
      <p className="text-xs text-slate-500">
        {value === null ? "Con làm thoải mái, hệ thống vẫn ghi lại thời gian làm bài." : "Như đi thi: có đồng hồ đếm ngược, hết giờ bài tự nộp."}
      </p>
    </div>
  )
}
