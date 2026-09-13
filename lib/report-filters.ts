import type { ActivityRow } from "@/lib/types"

/**
 * The Admin report's filter state. `"all"` (for the select filters) and `""`
 * (for the date bounds) both mean "no constraint on this axis".
 */
export type ActivityFilters = {
  member: string
  type: string
  subGroup: string
  from: string
  to: string
}

/**
 * The single source of truth for which activity rows the Admin report includes.
 *
 * Both the on-screen feed and the XLSX export call this with the same filter
 * state, so the exported spreadsheet always matches the visible report — the
 * whole point of the export feature. Dates compare as `YYYY-MM-DD` strings,
 * whose lexicographic order matches chronological order, consistent with how
 * `row.date` is stored everywhere else.
 *
 * Kept deliberately free of any client- or server-only imports so it can be
 * shared across the React component and the route handler.
 */
export function filterActivityRows(rows: ActivityRow[], f: ActivityFilters): ActivityRow[] {
  return rows.filter((row) => {
    if (f.subGroup !== "all" && row.memberSubGroup !== f.subGroup) return false
    if (f.member !== "all" && row.memberId !== f.member) return false
    if (f.type !== "all" && row.type !== f.type) return false
    if (f.from && row.date < f.from) return false
    if (f.to && row.date > f.to) return false
    return true
  })
}

/** Normalises an untrusted request body into a complete filter state. */
export function coerceActivityFilters(body: unknown): ActivityFilters {
  const b = (body ?? {}) as Record<string, unknown>
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback)
  return {
    member: str(b.member, "all"),
    type: str(b.type, "all"),
    subGroup: str(b.subGroup, "all"),
    from: str(b.from, ""),
    to: str(b.to, ""),
  }
}
