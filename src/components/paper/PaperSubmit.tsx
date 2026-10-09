import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Press from "@/components/fun/Press"
import { celebrate, spring } from "@/lib/animations"
import { play } from "@/hooks/useSound"
import { Camera, ChevronLeft, ChevronRight, Crop, Home, ImagePlus, RefreshCw, Send, Sun, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SUBJECTS } from "@/lib/subjects"
import { cn } from "@/lib/utils"
import type { SubjectId } from "@/lib/types"

interface Page {
  id: string
  url: string
}

const uid = () => Math.random().toString(36).slice(2, 9)

/** Simple drawing: phone held flat above a page, with light and level cues. */
function Illustration() {
  return (
    <svg viewBox="0 0 240 150" className="h-36 w-auto" aria-hidden>
      <circle cx="200" cy="28" r="14" fill="#fde68a" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={200 + Math.cos((a * Math.PI) / 180) * 19} y1={28 + Math.sin((a * Math.PI) / 180) * 19} x2={200 + Math.cos((a * Math.PI) / 180) * 25} y2={28 + Math.sin((a * Math.PI) / 180) * 25} stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      ))}
      <rect x="40" y="88" width="120" height="54" rx="6" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      {[100, 110, 120, 130].map((y, i) => <line key={y} x1="52" x2={i % 2 ? 128 : 146} y1={y} y2={y} stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />)}
      <rect x="72" y="14" width="56" height="62" rx="10" fill="#4f46e5" />
      <rect x="77" y="20" width="46" height="50" rx="5" fill="#e0e7ff" />
      <path d="M84 30v-5h5M116 25h5v5M121 60v5h-5M89 65h-5v-5" stroke="#4f46e5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="100" y1="78" x2="100" y2="86" stroke="#94a3b8" strokeWidth="2" strokeDasharray="2 3" />
      <circle cx="176" cy="112" r="13" fill="#10b981" />
      <path d="M170 112l4 4 8-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Detected-document frame drawn over the preview. */
function CropFrame() {
  const c = "absolute size-8 border-white border-[5px]"
  return (
    <div className="pointer-events-none absolute inset-[6%] rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] ring-2 ring-white/70">
      <span className={cn(c, "-top-1 -left-1 rounded-tl-xl border-r-0 border-b-0")} />
      <span className={cn(c, "-top-1 -right-1 rounded-tr-xl border-b-0 border-l-0")} />
      <span className={cn(c, "-bottom-1 -left-1 rounded-bl-xl border-t-0 border-r-0")} />
      <span className={cn(c, "-right-1 -bottom-1 rounded-br-xl border-t-0 border-l-0")} />
    </div>
  )
}

export default function PaperSubmit({
  title,
  subject,
  onClose,
  onSubmitted,
}: {
  title: string
  subject: SubjectId
  onClose: () => void
  onSubmitted: () => void
}) {
  const tone = SUBJECTS[subject]
  const reduced = useReducedMotion()
  const [flash, setFlash] = useState(0)
  const [pages, setPages] = useState<Page[]>([])
  const [active, setActive] = useState(0)
  const [retakeId, setRetakeId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
      urls.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  const addFiles = (files: FileList | null, fromCamera = false) => {
    if (!files?.length) return
    if (fromCamera) {
      play("shutter")
      setFlash((n) => n + 1)
    } else play("select")
    const fresh = Array.from(files).map((f) => {
      const url = URL.createObjectURL(f)
      urls.current.push(url)
      return { id: uid(), url }
    })
    if (retakeId) {
      setPages((p) => p.map((pg) => (pg.id === retakeId ? { ...pg, url: fresh[0].url } : pg)))
      setRetakeId(null)
    } else {
      setPages((p) => {
        setActive(p.length + fresh.length - 1)
        return [...p, ...fresh]
      })
    }
  }

  const remove = (id: string) =>
    setPages((p) => {
      const next = p.filter((pg) => pg.id !== id)
      setActive((a) => Math.min(a, Math.max(next.length - 1, 0)))
      return next
    })

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return
    setPages((p) => {
      const next = [...p]
      const [x] = next.splice(from, 1)
      next.splice(to, 0, x)
      return next
    })
    setActive(to)
  }

  const retake = (id: string) => {
    setRetakeId(id)
    cameraRef.current?.click()
  }

  const current = pages[active]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-lg" role="dialog" aria-modal aria-label={`Nộp bài giấy: ${title}`}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files, true); e.target.value = "" }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />

      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none fixed inset-0 z-[80] bg-white"
            initial={{ opacity: reduced ? 0.4 : 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.2 : 0.45, ease: "easeOut" }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <header className="border-b bg-white px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {!done && (
            <Button variant="ghost" size="icon" className="size-12 shrink-0 rounded-full [&_svg]:size-6" aria-label="Đóng" onClick={onClose}>
              <X />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-bold", tone.text)}>Nộp bài giấy · {tone.name}</p>
            <h1 className="truncate text-lg font-extrabold text-slate-900 md:text-xl">{title}</h1>
          </div>
        </div>
      </header>

      {done ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <MailboxScene reduced={reduced} />
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Đã nộp! Bố mẹ sẽ chấm sớm nhé 📮</h2>
          <p className="text-xl text-slate-500">Em đã gửi {pages.length} trang bài làm. Giỏi lắm!</p>
          <Press className="mt-2 max-w-sm">
            <Button className="h-16 w-full rounded-2xl text-xl font-extrabold [&_svg]:size-6" onClick={onSubmitted}>
              <Home />
              Về trang chính
            </Button>
          </Press>
        </main>
      ) : (
        <>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5 md:px-6">
              {!pages.length ? (
                <div className="flex flex-col items-center gap-4 rounded-[28px] border-2 border-dashed border-indigo-200 bg-white p-6 text-center md:p-10">
                  <Illustration />
                  <p className="text-2xl leading-snug font-extrabold text-slate-900">
                    Chụp rõ từng trang bài làm, đủ ánh sáng, không bị nghiêng.
                  </p>
                  <ul className="flex flex-wrap justify-center gap-2 text-base font-semibold text-slate-600">
                    <li className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-800"><Sun className="size-4" />Đủ sáng</li>
                    <li className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700"><Crop className="size-4" />Thấy cả trang</li>
                    <li className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">📐 Giữ máy thẳng</li>
                  </ul>
                </div>
              ) : (
                <>
                  {/* Preview */}
                  <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[28px] bg-slate-800 shadow-lg">
                    {current && <img src={current.url} alt={`Trang ${active + 1}`} className="size-full object-cover" />}
                    <CropFrame />
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-base font-extrabold text-slate-800">
                      Trang {active + 1}/{pages.length}
                    </span>
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold text-white">
                      <Crop className="size-4" />Tự cắt khung
                    </span>
                    <div className="absolute inset-x-3 bottom-3 flex justify-center gap-2">
                      <Button variant="secondary" className="h-12 rounded-full bg-white/95 px-4 text-base font-bold [&_svg]:size-5" onClick={() => current && retake(current.id)}>
                        <RefreshCw />Chụp lại
                      </Button>
                      <Button variant="secondary" className="h-12 rounded-full bg-white/95 px-4 text-base font-bold text-red-600 [&_svg]:size-5" onClick={() => current && remove(current.id)}>
                        <Trash2 />Xóa
                      </Button>
                    </div>
                  </div>

                  {/* Thumbnail strip */}
                  <div>
                    <p className="mb-2 text-base font-bold text-slate-600">Các trang đã chụp · kéo hoặc dùng mũi tên để đổi thứ tự</p>
                    <ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-2">
                      <AnimatePresence initial={false}>
                      {pages.map((pg, i) => (
                        <motion.li
                          key={pg.id}
                          layout={!reduced}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: -70, rotate: -12 }}
                          animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
                          transition={spring}
                          className="w-28 shrink-0"
                        >
                        <div
                          draggable
                          onDragStart={() => setDragId(pg.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            const from = pages.findIndex((p) => p.id === dragId)
                            if (from >= 0) move(from, i)
                            setDragId(null)
                          }}
                          className={cn("flex flex-col gap-1.5", dragId === pg.id && "opacity-50")}
                        >
                          <button
                            type="button"
                            onClick={() => setActive(i)}
                            aria-label={`Xem trang ${i + 1}`}
                            className={cn("relative aspect-[3/4] overflow-hidden rounded-2xl border-4 bg-slate-200", i === active ? "border-indigo-600" : "border-transparent")}
                          >
                            <img src={pg.url} alt="" className="size-full object-cover" />
                            <span className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-1 text-center text-sm font-bold text-white">Trang {i + 1}</span>
                          </button>
                          <div className="flex justify-between">
                            <button type="button" aria-label={`Chuyển trang ${i + 1} lên trước`} disabled={i === 0} onClick={() => move(i, i - 1)} className="flex size-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm disabled:opacity-30"><ChevronLeft className="size-5" /></button>
                            <button type="button" aria-label={`Chụp lại trang ${i + 1}`} onClick={() => retake(pg.id)} className="flex size-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm"><RefreshCw className="size-4" /></button>
                            <button type="button" aria-label={`Chuyển trang ${i + 1} ra sau`} disabled={i === pages.length - 1} onClick={() => move(i, i + 1)} className="flex size-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm disabled:opacity-30"><ChevronRight className="size-5" /></button>
                          </div>
                        </div>
                        </motion.li>
                      ))}
                      </AnimatePresence>
                      <li className="w-28 shrink-0">
                        <button type="button" onClick={() => cameraRef.current?.click()} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-base font-bold text-indigo-700">
                          <Camera className="size-7" />Thêm trang
                        </button>
                      </li>
                    </ol>
                  </div>
                </>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="h-16 rounded-2xl text-xl font-extrabold [&_svg]:size-7" variant={pages.length ? "outline" : "default"} onClick={() => { setRetakeId(null); cameraRef.current?.click() }}>
                  <Camera />
                  {pages.length ? "Chụp thêm trang" : "Chụp ảnh"}
                </Button>
                <Button variant="outline" className="h-16 rounded-2xl border-2 text-xl font-bold [&_svg]:size-7" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus />
                  Chọn ảnh có sẵn
                </Button>
              </div>
            </div>
          </main>

          <footer className="border-t bg-white px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="mx-auto max-w-3xl">
              <Button disabled={!pages.length} className="h-16 w-full rounded-2xl bg-emerald-600 text-xl font-extrabold hover:bg-emerald-700 [&_svg]:size-6" onClick={() => setConfirm(true)}>
                <Send />
                Nộp bài{pages.length ? ` (${pages.length} trang)` : ""}
              </Button>
            </div>
          </footer>
        </>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nộp {pages.length} trang này nhé?</DialogTitle>
            <DialogDescription className="text-base">Em kiểm tra xem đã chụp đủ và rõ tất cả các trang chưa.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 text-base" onClick={() => setConfirm(false)}>Kiểm tra lại</Button>
            <Button className="h-12 bg-emerald-600 text-base hover:bg-emerald-700" onClick={() => { setConfirm(false); play("submit"); setDone(true) }}>
              <Send />Nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Envelope slides down into the mailbox, the flag pops up, small confetti. */
function MailboxScene({ reduced }: { reduced: boolean | null }) {
  useEffect(() => {
    const t = window.setTimeout(() => { play("celebrate"); celebrate("small") }, reduced ? 100 : 750)
    return () => clearTimeout(t)
  }, [reduced])
  return (
    <div className="relative flex h-44 w-40 items-end justify-center" aria-hidden>
      <motion.span
        className="absolute top-0 text-6xl"
        initial={reduced ? { opacity: 1 } : { y: -60, opacity: 0, rotate: -15 }}
        animate={reduced ? { opacity: 0 } : { y: [-60, 0, 70], opacity: [0, 1, 0], rotate: [-15, 0, 0], scale: [1, 1, 0.6] }}
        transition={{ duration: 0.8, times: [0, 0.45, 1], ease: "easeIn" }}
      >
        ✉️
      </motion.span>
      <motion.span
        className="text-8xl"
        initial={{ scale: 1 }}
        animate={reduced ? {} : { scale: [1, 1, 1.15, 1], rotate: [0, 0, -6, 0] }}
        transition={{ duration: 1.1, times: [0, 0.7, 0.85, 1] }}
      >
        📮
      </motion.span>
    </div>
  )
}
