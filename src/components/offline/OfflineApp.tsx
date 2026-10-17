"use client"

import { useCallback, useEffect, useState } from "react"
import { CloudOff, Hourglass, Play, RotateCcw, Wifi } from "lucide-react"
import Press from "@/components/fun/Press"
import TakeRoute from "@/components/take/TakeRoute"
import type { TakeTimer } from "@/components/take/TakeAssignment"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { correctedNow } from "@/lib/offline/drafts"
import type { PackEntry } from "@/lib/offline/pack"
import { getMeta, listDrafts, listOutbox, listPack } from "@/lib/offline/store"
import { flushOutbox } from "@/lib/offline/sync-client"
import { formatDayMonth, formatTime } from "@/lib/format"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"

/*
 * "Làm bài offline": the screen the service worker serves when the app is
 * opened (or reloaded) without network. Everything comes from the device:
 * the downloaded assignments, drafts and queued hand-ins of the last child who
 * used it (see lib/offline/*).
 */

type Status = "todo" | "doing" | "pending" | "later"

interface Device {
  studentId: string
  name: string
  offset: number
  /** Corrected device time when the list was read ("Mở lúc …" checks). */
  now: number
  entries: PackEntry[]
  drafts: Set<string>
  pending: Set<string>
}

const STATUS_LABEL: Record<Exclude<Status, "later">, string> = { todo: "Chưa làm", doing: "Đang làm", pending: "Chờ gửi" }

export default function OfflineApp() {
  const [device, setDevice] = useState<Device | null | "none">(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)

  const load = useCallback(async () => {
    const [studentId, name, offset] = await Promise.all([getMeta("lastStudentId"), getMeta("lastStudentName"), getMeta("clockOffsetMs")])
    if (!studentId) return setDevice("none")
    const [entries, drafts, outbox] = await Promise.all([listPack(studentId), listDrafts(studentId), listOutbox(studentId)])
    setDevice({
      studentId,
      name: name ?? "",
      offset: offset ?? 0,
      now: correctedNow(offset ?? 0),
      entries: entries.sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
      drafts: new Set(drafts.map((d) => d.assignmentId)),
      pending: new Set(outbox.filter((o) => o.status === "pending").map((o) => o.assignmentId)),
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.mode = "student"
    const requested = new URLSearchParams(window.location.search).get("a")
    const update = () => setOnline(navigator.onLine)
    const timer = window.setTimeout(() => {
      update()
      if (requested) setOpenId(requested)
      void load().catch(() => setDevice("none"))
    }, 0)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [load])

  // Back online: send what was handed in here.
  useEffect(() => {
    if (!online || !device || device === "none") return
    void flushOutbox(device.studentId).then(() => load()).catch(() => {})
  }, [online, device, load])

  if (device === null) return null
  const statusOf = (e: PackEntry): Status => {
    if (device === "none") return "todo"
    if (device.pending.has(e.assignmentId)) return "pending"
    if (Date.parse(e.availableFrom) > device.now) return "later"
    return device.drafts.has(e.assignmentId) || e.draft ? "doing" : "todo"
  }

  const open = device !== "none" ? device.entries.find((e) => e.assignmentId === openId && statusOf(e) !== "pending" && statusOf(e) !== "later") : undefined
  if (device !== "none" && open) {
    const close = () => {
      window.history.replaceState(null, "", "/offline")
      setOpenId(null)
      void load()
    }
    return (
      <>
        <TakeRoute
          key={open.assignmentId}
          studentId={device.studentId}
          assignmentId={open.assignmentId}
          attemptNo={open.attemptNo}
          setVersion={open.setVersion}
          title={open.title}
          subject={open.subject}
          questions={open.questions}
          initialAnswers={open.draft?.responses ?? {}}
          serverDraft={Boolean(open.draft)}
          initialTimer={timerOf(open, device.offset)}
          timeLimitMinutes={open.timeLimitMinutes}
          exitTo={close}
        />
        <Toaster position="top-center" />
      </>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-16 text-lg">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Làm bài offline</h1>
        {online ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-800">
            <Wifi className="size-5" aria-hidden />
            <span className="flex-1">Có mạng rồi!</span>
            {/* A full load: the student pages are server-rendered and this screen lives outside their layout. */}
            {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
            <Button className="h-11 rounded-xl" onClick={() => window.location.assign("/student")}>Về trang chính</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 font-bold text-white">
            <CloudOff className="size-5" aria-hidden />
            Đang không có mạng — bài làm được lưu trên máy
          </div>
        )}
      </header>

      {device === "none" || device.entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
          <span className="text-6xl" aria-hidden>📭</span>
          <p className="text-xl font-extrabold text-slate-900">Chưa có bài nào được tải về máy</p>
          <p className="text-base text-slate-500">Khi có mạng, em mở ứng dụng một lần để bài được tải về nhé.</p>
        </div>
      ) : (
        <>
          {device.name && <p className="text-base font-semibold text-slate-500">Bài của {device.name}</p>}
          <ul className="flex flex-col gap-4">
            {device.entries.map((e) => {
              const s = SUBJECTS[e.subject]
              const status = statusOf(e)
              return (
                <li key={e.assignmentId} className={cn("flex flex-col gap-3 rounded-[28px] border-2 bg-white p-5", s.border)}>
                  <div className="flex items-start gap-4">
                    <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm", s.bg)}>
                      <s.icon className="size-7" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        <span className={s.text}>{s.name}</span>
                        <span className={cn("rounded-full px-2.5 py-0.5", status === "pending" ? "bg-violet-100 text-violet-700" : status === "doing" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
                          {status === "later" ? `Mở lúc ${formatTime(e.availableFrom)}, ${formatDayMonth(e.availableFrom)}` : STATUS_LABEL[status]}
                        </span>
                        {e.timeLimitMinutes && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">⏱ {e.timeLimitMinutes} phút</span>}
                      </div>
                      <h2 className="text-xl leading-snug font-extrabold text-slate-900">{e.title}</h2>
                      <p className="text-base text-slate-500">{e.questions.length} câu · Hạn {formatTime(e.dueAt)}, {formatDayMonth(e.dueAt)}</p>
                    </div>
                  </div>
                  {status === "pending" ? (
                    <Button disabled className="h-14 w-full rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 disabled:opacity-100 [&_svg]:size-6">
                      <Hourglass />
                      Đã nộp – chờ gửi khi có mạng
                    </Button>
                  ) : status !== "later" ? (
                    <Press>
                      <Button
                        className={cn("h-14 w-full rounded-2xl text-lg font-bold [&_svg]:size-6", status === "doing" && "bg-amber-500 hover:bg-amber-600")}
                        onClick={() => setOpenId(e.assignmentId)}
                      >
                        {status === "doing" ? <RotateCcw /> : <Play className="fill-current" />}
                        {status === "doing" ? "Làm tiếp" : "Bắt đầu"}
                      </Button>
                    </Press>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <Toaster position="top-center" />
    </main>
  )
}

/** Same rules as the take page: untimed counts up; a timed attempt the server started keeps its deadline. */
function timerOf(e: PackEntry, offset: number): TakeTimer | null {
  if (e.timeLimitMinutes === null) return { kind: "stopwatch", initialSeconds: e.draft?.durationSeconds ?? 0 }
  if (e.draft?.deadline) return { kind: "countdown", deadline: e.draft.deadline, serverNow: new Date(correctedNow(offset)).toISOString(), limitMinutes: e.timeLimitMinutes }
  return null
}
