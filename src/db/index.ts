import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> }

// Reuse one pool across dev hot reloads. `prepare: false` keeps it compatible with Supabase's transaction pooler.
const client = globalForDb.pg ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 })
if (process.env.NODE_ENV !== "production") globalForDb.pg = client

export const db = drizzle(client, { schema, casing: "snake_case" })
export type Db = typeof db
export { schema }
