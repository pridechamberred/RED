/**
 * Calendar-date helpers pinned to America/New_York (Orlando), where every Pride
 * Chamber event physically happens.
 *
 * Kept separate from the wall-clock instant math in `lib/calendar.ts` on
 * purpose: the Pride Chamber eligibility rule is "within the previous 31
 * calendar days in Orlando", which is a plain string comparison of `YYYY-MM-DD`
 * dates. Doing it that way — rather than comparing UTC instants — is what stops
 * an event slipping into the wrong day for anyone computing near midnight.
 *
 * Pure functions with no `server-only` marker so the same formatting can run on
 * the server (building option labels) without pulling server code into a bundle.
 */

export const EASTERN_TIME_ZONE = "America/New_York"

/** Today's calendar date in Eastern time, as `YYYY-MM-DD`. */
export function easternTodayISO(now: Date = new Date()): string {
  // en-CA renders a date as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/**
 * A `YYYY-MM-DD` string shifted by whole calendar days (negative to go back).
 *
 * The arithmetic runs in UTC on the bare year/month/day, so it is pure calendar
 * math with no timezone drift — "2026-09-13 minus 31" is always "2026-08-13".
 */
export function shiftISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** `MM/DD/YYYY` — the format the GrowthZone calendar's from/to filter expects. */
export function toUSDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${m}/${d}/${y}`
}

/** "September 2, 2026" — the display form used in the attendance dropdown. */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  // Built from a UTC instant of the bare date so the label never shifts a day.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
