import pg from "pg"

/*
 * Direct access to the local E2E database for specs that need a known set or
 * assignment, or want to check what was stored (the seed refuses non-local URLs).
 */

process.loadEnvFile(".env.local")
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

export const closeDb = () => pool.end()

export const sql = async <T extends pg.QueryResultRow>(text: string, params: unknown[] = []) => (await pool.query<T>(text, params)).rows

const mc = (prompt: string, options: string[], correctIndex: number) => ({ type: "trac-nghiem", prompt, options, correctIndex, points: 5, skills: ["Tính nhẩm"] })

/** A ready two-question set (answers: 56, then 54) with a unique title. */
export async function createSet(title: string): Promise<string> {
  const [{ household_id }] = await sql<{ household_id: string }>(`select household_id from students order by created_at limit 1`)
  const [set] = await sql<{ id: string }>(
    `insert into exercise_sets (household_id, title, subject, grade, estimated_minutes, kind, source, status) values ($1, $2, 'toan', 3, 10, 'luyen-tap', 'thu-cong', 'san-sang') returning id`,
    [household_id, title],
  )
  const questions = [mc("7 × 8 = ?", ["54", "56", "58", "64"], 1), mc("9 × 6 = ?", ["45", "54", "56", "63"], 1)]
  for (const [position, content] of questions.entries()) {
    await sql(`insert into questions (set_id, position, content) values ($1, $2, $3)`, [set.id, position, JSON.stringify(content)])
  }
  return set.id
}

/** A ready flashcard word list (Tiếng Anh) with a unique title. */
export async function createFlashcardSet(title: string, words: { word: string; explanation: string }[]): Promise<string> {
  const [{ household_id }] = await sql<{ household_id: string }>(`select household_id from students order by created_at limit 1`)
  const [set] = await sql<{ id: string }>(
    `insert into exercise_sets (household_id, title, subject, grade, estimated_minutes, kind, source, status, format) values ($1, $2, 'tieng-anh', 3, 5, 'chu-de', 'thu-cong', 'san-sang', 'flashcard') returning id`,
    [household_id, title],
  )
  for (const [position, w] of words.entries()) {
    const content = { type: "tu-vung", word: w.word, prompt: w.explanation, points: 1, skills: [] }
    await sql(`insert into questions (set_id, position, content) values ($1, $2, $3)`, [set.id, position, JSON.stringify(content)])
  }
  return set.id
}

/** A web assignment of `setId` for the first child, open now and due tomorrow. */
export async function assign(setId: string, timeLimitMinutes: number | null = null): Promise<string> {
  const [{ id }] = await sql<{ id: string }>(
    `insert into assignments (student_id, set_id, available_from, due_at, mode, max_attempts, time_limit_minutes)
     select id, $1, now() - interval '1 hour', now() + interval '1 day', 'web', 2, $2 from students order by created_at limit 1 returning id`,
    [setId, timeLimitMinutes],
  )
  return id
}

/** The attempts of an assignment, as the offline specs check them. */
export const attemptsOf = (assignmentId: string) =>
  sql<{ attempt_no: number; submitted: boolean; submitted_offline: boolean; score: number | null; answered: number }>(
    `select a.attempt_no, a.submitted_at is not null as submitted, a.submitted_offline, a.score,
            (select count(*)::int from answers w where w.attempt_id = a.id and w.response is not null) as answered
       from attempts a where a.assignment_id = $1 order by a.attempt_no`,
    [assignmentId],
  )
