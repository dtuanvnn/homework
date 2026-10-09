import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> }

/*
 * Use Supabase's *session* pooler (port 5432) in production: postgres-js
 * pipelines queries on a connection, and the transaction pooler (6543) hangs
 * on pipelined queries. Few connections per instance, closed when idle, so
 * serverless instances don't exhaust the pooler. One pool across dev hot reloads.
 */
const client =
  globalForDb.pg ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 })
if (process.env.NODE_ENV !== "production") globalForDb.pg = client

export const db = drizzle(client, { schema, casing: "snake_case" })
export type Db = typeof db
export { schema }
