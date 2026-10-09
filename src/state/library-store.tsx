import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import {
  TODAY,
  assignments as initialAssignments,
  attachmentsBySet,
  exerciseSets,
  sampleQuestions,
} from "@/data/mock-data"
import { uid } from "@/lib/questions"
import type { Assignment, Attachment, ExerciseSet, Question } from "@/lib/types"

interface LibraryStore {
  assignments: Assignment[]
  addAssignments: (items: Assignment[]) => void
  sets: ExerciseSet[]
  getSet: (id: string) => ExerciseSet | undefined
  getQuestions: (id: string) => Question[]
  getAttachments: (id: string) => Attachment[]
  saveSet: (
    set: ExerciseSet,
    questions: Question[],
    attachments: Attachment[],
  ) => void
  duplicateSet: (id: string) => ExerciseSet | undefined
  /** Removes a set and returns a function that restores it. */
  deleteSet: (id: string) => () => void
  markAssigned: (id: string) => void
  /** Creates an empty draft set and returns it. */
  createSet: () => ExerciseSet
  /** Adds a fully-formed set (e.g. from an AI scan) at the top of the library. */
  addSet: (
    set: ExerciseSet,
    questions: Question[],
    attachments: Attachment[],
  ) => void
}

const LibraryContext = createContext<LibraryStore | null>(null)

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = useState<Assignment[]>(
    initialAssignments.map((a, i) => ({
      ...a,
      mode: i % 3 === 1 ? "paper" : "web",
      maxAttempts: 2,
    })),
  )
  const addAssignments = useCallback((items: Assignment[]) => {
    setAssignments((prev) => [...prev, ...items])
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        timesAssigned:
          s.timesAssigned +
          items.filter((a) => a.exerciseSetId === s.id).length,
      })),
    )
  }, [])
  const [sets, setSets] = useState<ExerciseSet[]>(exerciseSets)
  const [questions, setQuestions] = useState<Record<string, Question[]>>({})
  const [attachments, setAttachments] =
    useState<Record<string, Attachment[]>>(attachmentsBySet)

  const getSet = useCallback(
    (id: string) => sets.find((s) => s.id === id),
    [sets],
  )
  const getQuestions = useCallback(
    (id: string) => questions[id] ?? sampleQuestions,
    [questions],
  )
  const getAttachments = useCallback(
    (id: string) => attachments[id] ?? [],
    [attachments],
  )

  const saveSet = useCallback(
    (set: ExerciseSet, qs: Question[], files: Attachment[]) => {
      setSets((prev) =>
        prev.map((s) =>
          s.id === set.id ? { ...set, questionCount: qs.length } : s,
        ),
      )
      setQuestions((prev) => ({ ...prev, [set.id]: qs }))
      setAttachments((prev) => ({ ...prev, [set.id]: files }))
    },
    [],
  )

  const duplicateSet = useCallback(
    (id: string) => {
      const original = sets.find((s) => s.id === id)
      if (!original) return undefined
      const copy: ExerciseSet = {
        ...original,
        id: uid("bt"),
        title: `${original.title} (bản sao)`,
        status: "nhap",
        timesAssigned: 0,
        createdAt: TODAY.toISOString(),
      }
      setSets((prev) => {
        const i = prev.findIndex((s) => s.id === id)
        return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
      })
      if (questions[id])
        setQuestions((prev) => ({ ...prev, [copy.id]: questions[id] }))
      if (attachments[id])
        setAttachments((prev) => ({ ...prev, [copy.id]: attachments[id] }))
      return copy
    },
    [sets, questions, attachments],
  )

  const deleteSet = useCallback(
    (id: string) => {
      const index = sets.findIndex((s) => s.id === id)
      const removed = sets[index]
      setSets((prev) => prev.filter((s) => s.id !== id))
      return () => {
        if (!removed) return
        setSets((prev) =>
          prev.some((s) => s.id === id)
            ? prev
            : [...prev.slice(0, index), removed, ...prev.slice(index)],
        )
      }
    },
    [sets],
  )

  const markAssigned = useCallback((id: string) => {
    setSets((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, timesAssigned: s.timesAssigned + 1 } : s,
      ),
    )
  }, [])

  const createSet = useCallback(() => {
    const set: ExerciseSet = {
      id: uid("bt"),
      title: "Bộ bài tập mới",
      subject: "toan",
      grade: 3,
      topic: "",
      description: "",
      kind: "luyen-tap",
      source: "thu-cong",
      status: "nhap",
      questionCount: 0,
      estimatedMinutes: 15,
      difficulty: 2,
      timesAssigned: 0,
      createdAt: TODAY.toISOString(),
    }
    setSets((prev) => [set, ...prev])
    setQuestions((prev) => ({ ...prev, [set.id]: [] }))
    return set
  }, [])

  const addSet = useCallback(
    (set: ExerciseSet, qs: Question[], files: Attachment[]) => {
      setSets((prev) => [{ ...set, questionCount: qs.length }, ...prev])
      setQuestions((prev) => ({ ...prev, [set.id]: qs }))
      setAttachments((prev) => ({ ...prev, [set.id]: files }))
    },
    [],
  )

  const value = useMemo(
    () => ({
      assignments,
      addAssignments,
      sets,
      getSet,
      getQuestions,
      getAttachments,
      saveSet,
      duplicateSet,
      deleteSet,
      markAssigned,
      createSet,
      addSet,
    }),
    [
      assignments,
      addAssignments,
      sets,
      getSet,
      getQuestions,
      getAttachments,
      saveSet,
      duplicateSet,
      deleteSet,
      markAssigned,
      createSet,
      addSet,
    ],
  )

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryStore {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>")
  return ctx
}
