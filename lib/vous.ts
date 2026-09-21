/**
 * Shared, dependency-free Vous helpers.
 *
 * Intentionally free of server-only imports so both the server (actions, data
 * loaders, email) and the client (forms, add-to-calendar) can use the same
 * types, labels, time math and calendar builders. Anything that must run on the
 * server only (the wall-clock → UTC conversion, which needs the calendar
 * timezone tables) lives in lib/calendar.ts.
 */

export type VousStatus = "pending" | "counter_proposed" | "confirmed" | "cancelled" | "expired"

/** One proposed availability window. Times are wall-clock in America/New_York. */
export type VousWindow = { date: string; start: string; end: string }

/** The minimal member facts a Vous view needs — no email, safe to ship to the client. */
export type VousParty = { id: string; firstName: string; lastName: string; company: string | null }

/** A fully-resolved request, serializable for passing into client components. */
export type VousRequestRecord = {
  id: string
  status: VousStatus
  inviter: VousParty
  invitee: VousParty
  /** Member id of whoever proposed the current windows. */
  proposedBy: string
  windows: VousWindow[]
  locations: VousLocationKey[]
  locationOther: string | null
  message: string | null
  confirmed: {
    date: string
    start: string
    end: string
    location: VousLocationKey | null
    locationOther: string | null
  } | null
  createdAt: string
}

export function partyName(p: VousParty): string {
  return `${p.firstName} ${p.lastName}`.trim()
}

/** The participant who is NOT the current proposer — i.e. whose turn it is. */
export function awaitingPartyId(r: Pick<VousRequestRecord, "inviter" | "invitee" | "proposedBy">): string {
  return r.proposedBy === r.inviter.id ? r.invitee.id : r.inviter.id
}

export type VousLocationKey =
  | "coffee"
  | "inviter_office"
  | "invitee_office"
  | "online"
  | "lunch"
  | "other"

export const VOUS_LOCATION_KEYS: VousLocationKey[] = [
  "coffee",
  "inviter_office",
  "invitee_office",
  "online",
  "lunch",
  "other",
]

export const VOUS_LOCATION_EMOJI: Record<VousLocationKey, string> = {
  coffee: "☕",
  inviter_office: "🏢",
  invitee_office: "🏢",
  online: "💻",
  lunch: "🍽️",
  other: "📍",
}

/**
 * The options shown to the INVITER on the request form, from their point of
 * view ("My office" is the inviter's, "Your office" is the invitee's).
 */
export const VOUS_LOCATION_OPTIONS: { key: VousLocationKey; label: string; emoji: string }[] = [
  { key: "coffee", label: "Coffee", emoji: VOUS_LOCATION_EMOJI.coffee },
  { key: "inviter_office", label: "My office", emoji: VOUS_LOCATION_EMOJI.inviter_office },
  { key: "invitee_office", label: "Your office", emoji: VOUS_LOCATION_EMOJI.invitee_office },
  { key: "online", label: "Online video meeting", emoji: VOUS_LOCATION_EMOJI.online },
  { key: "lunch", label: "Lunch", emoji: VOUS_LOCATION_EMOJI.lunch },
  { key: "other", label: "Other", emoji: VOUS_LOCATION_EMOJI.other },
]

export function isVousLocationKey(value: string): value is VousLocationKey {
  return (VOUS_LOCATION_KEYS as string[]).includes(value)
}

/**
 * A location key rendered from a given viewer's point of view. The two "office"
 * keys are relative, so they read differently for the inviter and the invitee.
 */
export function vousLocationLabel(key: VousLocationKey, viewerIsInviter: boolean): string {
  switch (key) {
    case "coffee":
      return "Coffee"
    case "online":
      return "Online video meeting"
    case "lunch":
      return "Lunch"
    case "other":
      return "Other"
    case "inviter_office":
      return viewerIsInviter ? "My office" : "Their office"
    case "invitee_office":
      return viewerIsInviter ? "Your office" : "My office"
  }
}

/**
 * An absolute, name-based label for a confirmed location, used where there is no
 * single "viewer" — the celebration screen and the confirmation emails that go
 * to both people.
 */
export function confirmedLocationLabel(
  key: VousLocationKey | null,
  inviterFirstName: string,
  inviteeFirstName: string,
  other: string | null,
): string {
  switch (key) {
    case "coffee":
      return "Coffee"
    case "online":
      return "Online video meeting"
    case "lunch":
      return "Lunch"
    case "inviter_office":
      return `${inviterFirstName}'s office`
    case "invitee_office":
      return `${inviteeFirstName}'s office`
    case "other":
      return other?.trim() ? other.trim() : "To be decided"
    default:
      return "To be decided"
  }
}

// ---------------------------------------------------------------------------
// Time + date formatting (Intl works identically on client and server).
// ---------------------------------------------------------------------------

const TZ = "America/New_York"

/** "Wednesday, September 23" from a YYYY-MM-DD date. */
export function formatVousDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ })
}

/** "Wed, Sep 23" — compact, for dashboard cards. */
export function formatVousDateShort(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })
}

export function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function minutesToTime(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** '14:30' → '2:30 PM'. */
export function formatTime(time: string): string {
  const mins = timeToMinutes(time)
  if (mins === null) return time
  let h = Math.floor(mins / 60)
  const m = mins % 60
  const ap = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, "0")} ${ap}`
}

/** '2:00 PM – 5:00 PM'. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** "Wednesday, September 23 · 2:00 PM – 5:00 PM". */
export function formatWindow(w: VousWindow): string {
  return `${formatVousDate(w.date)} · ${formatTimeRange(w.start, w.end)}`
}

/**
 * Validates + normalises a raw window. Returns null when the shape is wrong or
 * start is not strictly before end. Used on both sides of the wire.
 */
export function normalizeWindow(raw: unknown): VousWindow | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const date = typeof r.date === "string" ? r.date : ""
  const start = typeof r.start === "string" ? r.start : ""
  const end = typeof r.end === "string" ? r.end : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === null || e === null || s >= e) return null
  return { date, start: minutesToTime(s), end: minutesToTime(e) }
}

// ---------------------------------------------------------------------------
// Add-to-calendar builders. Given the exact UTC instants (computed server-side
// with the timezone tables), these are pure string assembly and safe anywhere.
// ---------------------------------------------------------------------------

/** '2026-09-23T18:00:00.000Z' → '20260923T180000Z'. */
export function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}(?=Z$)/, "")
}

export type CalendarEvent = {
  title: string
  details: string
  location: string
  startUtcISO: string
  endUtcISO: string
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsStamp(event.startUtcISO)}/${icsStamp(event.endUtcISO)}`,
    details: event.details,
    location: event.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcs(event: CalendarEvent & { uid: string }): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//incREDible//Vous Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(event.startUtcISO)}`,
    `DTEND:${icsStamp(event.endUtcISO)}`,
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(event.details)}`,
    `LOCATION:${esc(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}
