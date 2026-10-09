"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  createAssignments,
  createExerciseSet,
  deleteExerciseSet,
  duplicateExerciseSet,
  loadQuestions,
  quickAssign,
  requestSetUploads,
  saveExerciseSet,
  type NewAssignment,
} from "@/server/actions/library"
import { uploadFiles } from "@/lib/upload-client"
import type { Assignment, Attachment, ExerciseSet, Question } from "@/lib/types"

/*
 * Client cache of the exercise library and assignments, seeded by the server
 * layout and kept in sync through Server Actions (which call refresh(), so
 * the layout re-renders with fresh props).
 */

interface LibraryStore {
  assignments: Assignment[]
  /** Creates assignments (validated server side) and returns them. */
  addAssignments: (items: NewAssignment[]) => Promise<Assignment[]>
  sets: ExerciseSet[]
  getSet: (id: string) => ExerciseSet | undefined
  /** Cached questions of a set; fetched on first request, [] until loaded. */
  getQuestions: (id: string) => Question[]
  questionsLoaded: (id: string) => boolean
  getAttachments: (id: string) => Attachment[]
  /** Seeds the cache with data the server already loaded (detail page). */
  primeSet: (id: string, questions: Question[], attachments: Attachment[]) => void
  /** Uploads new files and saves the set. Resolves to false (after a toast) on failure. */
  saveSet: (set: ExerciseSet, questions: Question[], attachments: Attachment[]) => Promise<boolean>
  /** Saves a brand-new set built on the client (upload scan, AI). `set.id` must be a UUID. */
  addSet: (set: ExerciseSet, questions: Question[], attachments: Attachment[]) => Promise<boolean>
  duplicateSet: (id: string) => Promise<ExerciseSet | undefined>
  /** Hides a set now and deletes it after the undo window; returns the undo function. */
  deleteSet: (id: string) => () => void
  /** Assigns the set now, due tomorrow evening. */
  assignSet: (id: string) => Promise<Assignment | undefined>
  /** Creates an empty draft set and returns it. */
  createSet: () => Promise<ExerciseSet>
}

const UNDO_MS = 6000

const LibraryContext = createContext<LibraryStore | null>(null)

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra. Vui lòng thử lại.")

export function LibraryProvider({
  initialSets,
  initialAssignments,
  children,
}: {
  initialSets: ExerciseSet[]
  initialAssignments: Assignment[]
  children: React.ReactNode
}) {
  const [sets, setSets] = useState(initialSets)
  const [assignments, setAssignments] = useState(initialAssignments)
  // Re-sync when the server sends fresh data (after refresh()).
  const [prevProps, setPrevProps] = useState({ initialSets, initialAssignments })
  const hidden = useRef(new Set<string>())
  if (prevProps.initialSets !== initialSets || prevProps.initialAssignments !== initialAssignments) {
    setPrevProps({ initialSets, initialAssignments })
    setSets(initialSets.filter((s) => !hidden.current.has(s.id)))
    setAssignments(initialAssignments)
  }

  const [questions, setQuestions] = useState<Record<string, Question[]>>({})
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const loading = useRef(new Set<string>())

  const getSet = useCallback((id: string) => sets.find((s) => s.id === id), [sets])

  const getQuestions = useCallback(
    (id: string) => {
      const cached = questions[id]
      if (cached) return cached
      if (!loading.current.has(id)) {
        loading.current.add(id)
        void loadQuestions(id)
          .then((qs) => setQuestions((prev) => (prev[id] ? prev : { ...prev, [id]: qs })))
          .catch(() => loading.current.delete(id))
      }
      return []
    },
    [questions],
  )
  const questionsLoaded = useCallback((id: string) => id in questions, [questions])
  const getAttachments = useCallback((id: string) => attachments[id] ?? [], [attachments])

  const primeSet = useCallback((id: string, qs: Question[], files: Attachment[]) => {
    setQuestions((prev) => ({ ...prev, [id]: qs }))
    setAttachments((prev) => ({ ...prev, [id]: files }))
  }, [])

  const persist = useCallback(async (set: ExerciseSet, qs: Question[], files: Attachment[]) => {
    try {
      const fresh = files.filter((f) => f.file)
      const newFiles = await uploadFiles(
        fresh.map((f) => f.file!),
        (names) => requestSetUploads(set.id, names),
      )
      const saved = await saveExerciseSet({
        set: {
          id: set.id,
          title: set.title,
          subject: set.subject,
          grade: set.grade,
          topic: set.topic,
          description: set.description,
          estimatedMinutes: set.estimatedMinutes,
          difficulty: set.difficulty,
          kind: set.kind,
          source: set.source,
          status: set.status,
        },
        questions: qs,
        keepAttachmentIds: files.filter((f) => !f.file).map((f) => f.id),
        newFiles,
      })
      for (const f of fresh) if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url)
      setSets((prev) => (prev.some((s) => s.id === set.id) ? prev.map((s) => (s.id === set.id ? saved.set : s)) : [saved.set, ...prev]))
      setQuestions((prev) => ({ ...prev, [set.id]: qs }))
      setAttachments((prev) => ({ ...prev, [set.id]: saved.attachments }))
      return true
    } catch (e) {
      toast.error("Không lưu được bộ bài", { description: errorMessage(e) })
      return false
    }
  }, [])

  const duplicateSet = useCallback(async (id: string) => {
    try {
      const copy = await duplicateExerciseSet(id)
      setSets((prev) => {
        const i = prev.findIndex((s) => s.id === id)
        return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
      })
      return copy
    } catch (e) {
      toast.error("Không nhân bản được", { description: errorMessage(e) })
      return undefined
    }
  }, [])

  const deleteSet = useCallback(
    (id: string) => {
      const index = sets.findIndex((s) => s.id === id)
      const removed = sets[index]
      hidden.current.add(id)
      setSets((prev) => prev.filter((s) => s.id !== id))
      const restoreLocal = () => {
        hidden.current.delete(id)
        if (!removed) return
        setSets((prev) => (prev.some((s) => s.id === id) ? prev : [...prev.slice(0, index), removed, ...prev.slice(index)]))
      }
      const timer = window.setTimeout(async () => {
        const result = await deleteExerciseSet(id).catch((e) => ({ ok: false as const, error: errorMessage(e) }))
        if (!result.ok) {
          restoreLocal()
          toast.error("Không xóa được bộ bài", { description: result.error })
        } else hidden.current.delete(id)
      }, UNDO_MS)
      return () => {
        window.clearTimeout(timer)
        restoreLocal()
      }
    },
    [sets],
  )

  const addAssignments = useCallback(async (items: NewAssignment[]) => {
    const created = await createAssignments(items)
    setAssignments((prev) => [...prev, ...created])
    setSets((prev) =>
      prev.map((s) => ({ ...s, timesAssigned: s.timesAssigned + created.filter((a) => a.exerciseSetId === s.id).length })),
    )
    return created
  }, [])

  const assignSet = useCallback(async (id: string) => {
    try {
      const created = await quickAssign(id)
      setAssignments((prev) => [...prev, created])
      setSets((prev) => prev.map((s) => (s.id === id ? { ...s, timesAssigned: s.timesAssigned + 1 } : s)))
      return created
    } catch (e) {
      toast.error("Không giao được bài", { description: errorMessage(e) })
      return undefined
    }
  }, [])

  const createSet = useCallback(async () => {
    const set = await createExerciseSet()
    setSets((prev) => [set, ...prev])
    setQuestions((prev) => ({ ...prev, [set.id]: [] }))
    setAttachments((prev) => ({ ...prev, [set.id]: [] }))
    return set
  }, [])

  const value = useMemo<LibraryStore>(
    () => ({
      assignments,
      addAssignments,
      sets,
      getSet,
      getQuestions,
      questionsLoaded,
      getAttachments,
      primeSet,
      saveSet: persist,
      addSet: persist,
      duplicateSet,
      deleteSet,
      assignSet,
      createSet,
    }),
    [assignments, addAssignments, sets, getSet, getQuestions, questionsLoaded, getAttachments, primeSet, persist, duplicateSet, deleteSet, assignSet, createSet],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryStore {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>")
  return ctx
}
