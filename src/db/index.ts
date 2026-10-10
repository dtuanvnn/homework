import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, types } from "pg"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { pgPool?: Pool }

/*
 * node-postgres against Supabase's *transaction* pooler (port 6543) in
 * production. The session pooler caps clients at 15, which serverless
 * instances exhaust; postgres-js pipelines queries, which the transaction
 * pooler hangs on. pg runs one query at a time per connection, so the
 * transaction pooler works. Few connections per instance, closed when idle.
 */
/*
 * pg parses json/jsonb itself and Drizzle JSON.parses any string it gets
 * back, so a stored string like "9875" came out as the number 9875. Hand
 * Drizzle the raw text so it parses once. Global, because Drizzle passes its
 * own per-query parsers that fall back to pg's global ones.
 */
types.setTypeParser(types.builtins.JSON, (value) => value)
types.setTypeParser(types.builtins.JSONB, (value) => value)

function createPool() {
  const url = process.env.DATABASE_URL!
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url)
  return new Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Encrypt remote connections; Supabase's pooler certificate isn't in Node's default CA list.
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
}

// One pool across dev hot reloads.
const pool = globalForDb.pgPool ?? createPool()
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool

export const db = drizzle(pool, { schema, casing: "snake_case" })
export type Db = typeof db
export { schema }
