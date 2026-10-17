/** What came back from a Server Action call: a reply (ok or refused), or no reply at all. */
export type NetOutcome<T> = { kind: "ok"; value: Extract<T, { ok: true }> } | { kind: "network" } | { kind: "server"; error: string; expired?: boolean }

/** `res` is null when the call threw (network down, request aborted). */
export function classify<T extends { ok: boolean; error?: string; expired?: boolean }>(res: T | null): NetOutcome<T> {
  if (!res) return { kind: "network" }
  if (!res.ok) return { kind: "server", error: res.error ?? "", expired: res.expired }
  return { kind: "ok", value: res as Extract<T, { ok: true }> }
}

/** Work started offline keeps its device clock until it is handed in, so it always goes through the outbox. */
export function submitRoute(origin: "server" | "device", online: boolean): "server" | "outbox" {
  return origin === "server" && online ? "server" : "outbox"
}
