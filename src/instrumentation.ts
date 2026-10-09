/**
 * Runs once per server instance. Hosting (Vercel) runs in UTC, but "today",
 * due times and week boundaries are all Vietnam time, so pin the process
 * time zone before any request is handled. Vietnam has no DST.
 */
export function register() {
  process.env.TZ = "Asia/Ho_Chi_Minh"
}
