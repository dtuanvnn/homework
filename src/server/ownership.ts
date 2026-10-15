import "server-only"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/db"
import { isUuid } from "@/lib/ids"
import type { Context } from "./access"

/*
 * Out-of-scope ids look exactly like missing ones. Parent mode: anything in the
 * household. Student mode: only the device child's assignments, attempts and
 * redemptions.
 */

const { exerciseSets, assignments, attempts, students, rewards, rewardRedemptions } = schema

export const NOT_FOUND = "Không tìm thấy."

function checkId(id: string) {
  if (!isUuid(id)) throw new Error(NOT_FOUND)
}

const ownChild = (ctx: Context) => (ctx.mode === "student" ? eq(assignments.studentId, ctx.studentId!) : undefined)

export async function assertSetInHousehold(ctx: Context, setId: string) {
  checkId(setId)
  const [row] = await db
    .select({ id: exerciseSets.id })
    .from(exerciseSets)
    .where(and(eq(exerciseSets.id, setId), eq(exerciseSets.householdId, ctx.householdId)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertAssignmentInScope(ctx: Context, assignmentId: string) {
  checkId(assignmentId)
  const [row] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(students, eq(students.id, assignments.studentId))
    .where(and(eq(assignments.id, assignmentId), eq(students.householdId, ctx.householdId), ownChild(ctx)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertAttemptInScope(ctx: Context, attemptId: string) {
  checkId(attemptId)
  const [row] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
    .innerJoin(students, eq(students.id, assignments.studentId))
    .where(and(eq(attempts.id, attemptId), eq(students.householdId, ctx.householdId), ownChild(ctx)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertRewardInHousehold(ctx: Context, rewardId: string) {
  checkId(rewardId)
  const [row] = await db.select({ id: rewards.id }).from(rewards).where(and(eq(rewards.id, rewardId), eq(rewards.householdId, ctx.householdId)))
  if (!row) throw new Error(NOT_FOUND)
}

export async function assertRedemptionInScope(ctx: Context, redemptionId: string) {
  checkId(redemptionId)
  const [row] = await db
    .select({ id: rewardRedemptions.id })
    .from(rewardRedemptions)
    .innerJoin(students, eq(students.id, rewardRedemptions.studentId))
    .where(
      and(
        eq(rewardRedemptions.id, redemptionId),
        eq(students.householdId, ctx.householdId),
        ctx.mode === "student" ? eq(rewardRedemptions.studentId, ctx.studentId!) : undefined,
      ),
    )
  if (!row) throw new Error(NOT_FOUND)
}
