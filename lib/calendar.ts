import "server-only"

import { SUB_GROUPS, type SubGroup } from "@/lib/types"

/**
 * Upcoming RED meetings, read from the chamber's public Google Calendar.
 *
 * The feed hands back *recurrence rules*, not individual meetings: ten VEVENTs
 * each carrying `RRULE:FREQ=MONTHLY;BYDAY=<n><WEEKDAY>` with no end date. So the
 * next twenty meetings have to be generated here — reading DTSTART alone would
 * show ten dates in one month and then never move again.
 */

/** Public calendar id (base64 of the address in the share link the chamber uses). */
const CALENDAR_ID = "pridechamberred@gmail.com"

/** The calendar's own timezone (X-WR-TIMEZONE). Meetings are physical, so they
 *  are always shown in the venue's local time rather than the viewer's. */
export const CALENDAR_TIME_ZONE = "America/New_York"

const FEED_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(
  CALENDAR_ID,
)}/public/basic.ics`

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

export type Meeting = {
  /** Stable key for React. */
  id: string
  /** Exact instant the meeting starts, as an ISO string. */
  startISO: string
  /** e.g. "RED Central" — the calendar's own event title. */
  title: string
  /** Venue as entered in the calendar, or null when the event has no location. */
  location: string | null
}

/**
 * Maps a calendar event title onto one of the app's five sub-groups.
 *
 * The calendar's titles are not identical to `SUB_GROUPS`: the Zoom group is
 * called "RED Connect (Zoom)" there, and an organiser may add a suffix such as
 * "RED Central — Guest Day". So this normalises rather than compares exactly,
 * and returns null when nothing matches so callers can fall back instead of
 * silently attributing a guest to the wrong group.
 */
export function subGroupFromTitle(title: string): SubGroup | null {
  const normalised = title.toLowerCase().replace(/[^a-z]+/g, " ")

  for (const group of SUB_GROUPS) {
    const needle = group.toLowerCase().replace(/[^a-z]+/g, " ")
    if (normalised.includes(needle)) return group
  }

  // "RED Connect" was called "RED Virtual" until Aug 2026; tolerate either in
  // case an older recurring event still carries the previous name.
  if (/\bvirtual\b|\bzoom\b|\bonline\b/.test(normalised)) return "RED Connect"

  return null
}

/** A wall-clock date/time, deliberately with no timezone attached. */
type WallTime = { year: number; month: number; day: number; hour: number; minute: number }

type ParsedEvent = {
  uid: string
  title: string
  location: string | null
  cancelled: boolean
  /** Local wall time when TZID/floating, else null with `startUtc` set. */
  wall: WallTime | null
  startUtc: Date | null
  allDay: boolean
  rrule: Record<string, string> | null
  /** Instances removed from the series. */
  exDates: Set<string>
  /** Set when this VEVENT overrides a single instance of a series. */
  recurrenceId: string | null
}

/**
 * Turns a wall-clock time in a named zone into the correct UTC instant.
 *
 * Needed because DTSTART is `;TZID=America/New_York:20260903T090000` — a local
 * time whose UTC offset depends on whether DST is in effect (-04:00 in
 * September, -05:00 in December). Parsing it as UTC would shift every meeting
 * by four or five hours.
 */
function wallTimeToUtc(wall: WallTime, timeZone: string): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0)
  // Two passes settle the case where the guess lands on the other side of a
  // DST boundary from the real instant.
  let ts = naive - zoneOffsetMs(timeZone, naive)
  ts = naive - zoneOffsetMs(timeZone, ts)
  return new Date(ts)
}

/** How far ahead of UTC `timeZone` is at the given instant, in ms. */
function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant))

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  // `hour12: false` can render midnight as hour 24.
  const hour = get("hour") % 24

  return Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second")) - instant
}

/** ICS folds long lines by starting the continuation with a space or tab. */
function unfold(raw: string): string[] {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n")
}

/** ICS escapes commas, semicolons and newlines inside text values. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim()
}

function parseDateValue(params: string, value: string): Pick<ParsedEvent, "wall" | "startUtc" | "allDay"> {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return {
      wall: { year: +y, month: +m, day: +d, hour: 0, minute: 0 },
      startUtc: null,
      allDay: true,
    }
  }

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value)
  if (!dateTime) return { wall: null, startUtc: null, allDay: false }

  const [, y, m, d, hh, mm, ss, zulu] = dateTime

  // A trailing Z means the value is already UTC; no zone conversion needed.
  if (zulu === "Z" && !params.includes("TZID=")) {
    return { wall: null, startUtc: new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)), allDay: false }
  }

  return {
    wall: { year: +y, month: +m, day: +d, hour: +hh, minute: +mm },
    startUtc: null,
    allDay: false,
  }
}

function parseFeed(raw: string): ParsedEvent[] {
  const events: ParsedEvent[] = []
  let current: ParsedEvent | null = null
  let inTimezone = false

  for (const line of unfold(raw)) {
    // VTIMEZONE blocks contain their own DTSTART/RRULE; ignore them entirely.
    if (line === "BEGIN:VTIMEZONE") inTimezone = true
    else if (line === "END:VTIMEZONE") inTimezone = false
    else if (inTimezone) continue
    else if (line === "BEGIN:VEVENT") {
      current = {
        uid: "",
        title: "",
        location: null,
        cancelled: false,
        wall: null,
        startUtc: null,
        allDay: false,
        rrule: null,
        exDates: new Set(),
        recurrenceId: null,
      }
    } else if (line === "END:VEVENT") {
      if (current) events.push(current)
      current = null
    } else if (current) {
      const split = line.indexOf(":")
      if (split === -1) continue

      const rawName = line.slice(0, split)
      const value = line.slice(split + 1)
      const semi = rawName.indexOf(";")
      const name = semi === -1 ? rawName : rawName.slice(0, semi)
      const params = semi === -1 ? "" : rawName.slice(semi)

      switch (name) {
        case "UID":
          current.uid = value.trim()
          break
        case "SUMMARY":
          current.title = unescapeText(value)
          break
        case "LOCATION": {
          const location = unescapeText(value)
          current.location = location.length > 0 ? location : null
          break
        }
        case "STATUS":
          if (value.trim().toUpperCase() === "CANCELLED") current.cancelled = true
          break
        case "DTSTART":
          Object.assign(current, parseDateValue(params, value.trim()))
          break
        case "RRULE": {
          const rule: Record<string, string> = {}
          for (const part of value.split(";")) {
            const [k, v] = part.split("=")
            if (k && v) rule[k.trim().toUpperCase()] = v.trim().toUpperCase()
          }
          current.rrule = rule
          break
        }
        case "EXDATE":
          for (const item of value.split(",")) {
            current.exDates.add(item.trim().replace(/Z$/, "").slice(0, 15))
          }
          break
        case "RECURRENCE-ID":
          current.recurrenceId = value.trim().replace(/Z$/, "").slice(0, 15)
          break
      }
    }
  }

  return events
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Day-of-month for the nth (or -nth) weekday of a month, or null if absent. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number | null {
  const total = daysInMonth(year, month)

  if (n > 0) {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
    return day <= total ? day : null
  }

  const lastWeekday = new Date(Date.UTC(year, month - 1, total)).getUTCDay()
  const day = total - ((lastWeekday - weekday + 7) % 7) + (n + 1) * 7
  return day >= 1 ? day : null
}

function wallKey(wall: WallTime): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${wall.year}${pad(wall.month)}${pad(wall.day)}T${pad(wall.hour)}${pad(wall.minute)}00`
}

/**
 * Expands one event into concrete wall-clock start times.
 *
 * Arithmetic stays in wall-clock terms throughout — "first Thursday, 9:00 AM
 * local" must survive a DST change rather than drifting to 8:00 or 10:00.
 */
function expand(event: ParsedEvent, horizon: number, notBefore: Date, timeZone: string): WallTime[] {
  const base = event.wall
  if (!base) return []

  const rule = event.rrule
  if (!rule) return [base]

  const freq = rule.FREQ
  const interval = Math.max(1, Number(rule.INTERVAL ?? "1") || 1)
  const count = rule.COUNT ? Number(rule.COUNT) : null
  const until = rule.UNTIL ? parseDateValue("", rule.UNTIL)  : null
  const untilInstant = until?.startUtc ?? (until?.wall ? wallTimeToUtc(until.wall, timeZone) : null)

  const out: WallTime[] = []
  const push = (wall: WallTime) => {
    if (event.exDates.has(wallKey(wall))) return
    if (untilInstant && wallTimeToUtc(wall, timeZone) > untilInstant) return
    out.push(wall)
  }

  // Generated far enough back that already-started series still line up, then
  // filtered to the future by the caller.
  const startYear = base.year
  const startMonth = base.month

  if (freq === "MONTHLY" || freq === "YEARLY") {
    const byDay = rule.BYDAY
    const byMonthDay = rule.BYMONTHDAY ? Number(rule.BYMONTHDAY) : null
    const step = freq === "YEARLY" ? 12 * interval : interval

    for (let i = 0; out.length < horizon && i < 400; i++) {
      const absolute = (startYear * 12 + (startMonth - 1)) + i * step
      const year = Math.floor(absolute / 12)
      const month = (absolute % 12) + 1

      let day: number | null = null
      if (byDay) {
        const match = /^(-?\d+)?([A-Z]{2})$/.exec(byDay)
        if (!match) break
        const weekday = WEEKDAYS[match[2]]
        if (weekday === undefined) break
        // No ordinal in a monthly rule is ambiguous; treat as the first.
        day = nthWeekdayOfMonth(year, month, weekday, match[1] ? Number(match[1]) : 1)
      } else {
        day = byMonthDay ?? base.day
        if (day > daysInMonth(year, month)) day = null
      }

      if (day === null) continue

      const wall = { ...base, year, month, day }
      if (wallTimeToUtc(wall, timeZone).getTime() >= notBefore.getTime() - 86_400_000) push(wall)
      if (count && i + 1 >= count) break
    }

    return out
  }

  const stepDays = freq === "WEEKLY" ? 7 * interval : freq === "DAILY" ? interval : null
  if (stepDays === null) return [base]

  const weekdays = rule.BYDAY
    ? rule.BYDAY.split(",")
        .map((d) => WEEKDAYS[d.replace(/^-?\d+/, "")])
        .filter((d): d is number => d !== undefined)
    : null

  // Walk day by day for weekly/daily so BYDAY lists work naturally.
  const cursor = new Date(Date.UTC(base.year, base.month - 1, base.day))
  const perStep = freq === "DAILY" ? interval : 1
  for (let i = 0; out.length < horizon && i < 1500; i += perStep) {
    const probe = new Date(cursor.getTime() + i * 86_400_000)
    if (freq === "WEEKLY" && interval > 1) {
      const weeks = Math.floor(i / 7)
      if (weeks % interval !== 0) continue
    }
    if (weekdays && !weekdays.includes(probe.getUTCDay())) continue

    const wall = {
      ...base,
      year: probe.getUTCFullYear(),
      month: probe.getUTCMonth() + 1,
      day: probe.getUTCDate(),
    }
    if (wallTimeToUtc(wall, timeZone).getTime() >= notBefore.getTime() - 86_400_000) push(wall)
    if (count && out.length >= count) break
  }

  return out
}

/**
 * Fetches and parses the feed. Never throws: the calendar is a third party, and
 * an outage there must not take down the pages that read it.
 */
async function fetchEvents(): Promise<ParsedEvent[]> {
  try {
    const response = await fetch(FEED_URL, {
      // Meetings change rarely; refresh hourly rather than on every request.
      next: { revalidate: 3600 },
    })
    if (!response.ok) {
      console.error(`calendar feed responded ${response.status}`)
      return []
    }
    return parseFeed(await response.text())
  } catch (error) {
    console.error("calendar feed unreachable:", error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Expands every series and returns the occurrences inside [from, to], oldest
 * first. `to` of null means "no upper bound".
 */
function collect(
  events: ParsedEvent[],
  { from, to, perSeries }: { from: Date; to: Date | null; perSeries: number },
): Meeting[] {
  // A VEVENT carrying RECURRENCE-ID replaces one instance of its series.
  const overrides = new Map<string, ParsedEvent>()
  for (const event of events) {
    if (event.recurrenceId) overrides.set(`${event.uid}::${event.recurrenceId}`, event)
  }

  const meetings: Meeting[] = []

  for (const event of events) {
    if (event.cancelled || event.recurrenceId) continue

    for (const wall of expand(event, perSeries, from, CALENDAR_TIME_ZONE)) {
      const override = overrides.get(`${event.uid}::${wallKey(wall)}`)
      if (override?.cancelled) continue

      const source = override ?? event
      const start =
        override?.startUtc ??
        (override?.wall ? wallTimeToUtc(override.wall, CALENDAR_TIME_ZONE) : null) ??
        wallTimeToUtc(wall, CALENDAR_TIME_ZONE)

      if (start.getTime() < from.getTime()) continue
      if (to && start.getTime() > to.getTime()) continue

      meetings.push({
        id: `${event.uid}::${start.toISOString()}`,
        startISO: start.toISOString(),
        title: source.title || event.title,
        location: source.location ?? event.location,
      })
    }
  }

  // Non-recurring events are added verbatim above, so sort and de-duplicate.
  const seen = new Set<string>()
  return meetings
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
    .filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
}

/** The next `limit` meetings, soonest first. */
export async function getUpcomingMeetings(limit = 20): Promise<Meeting[]> {
  const events = await fetchEvents()
  return collect(events, { from: new Date(), to: null, perSeries: limit + 8 }).slice(0, limit)
}

/** How far back the attendance register looks. */
export const REGISTER_WINDOW_DAYS = 31

/** The last moment of `instant`'s calendar day, in the calendar's timezone. */
function endOfDayInZone(instant: Date, timeZone: string): Date {
  // en-CA gives YYYY-MM-DD, which is trivially splittable.
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .split("-")
    .map(Number)

  return wallTimeToUtc({ year, month, day, hour: 23, minute: 59 }, timeZone)
}

/**
 * Meetings eligible for the attendance register: anything from `days` ago up to
 * the end of today, newest first.
 *
 * The upper bound is the end of *today* rather than "now" so a register can be
 * filled in on the morning of a meeting, which is when an admin is actually
 * standing in the room. `now` is injectable purely so this can be tested against
 * a date when meetings exist.
 */
export async function getRecentMeetings(now: Date = new Date(), days = REGISTER_WINDOW_DAYS): Promise<Meeting[]> {
  const events = await fetchEvents()
  const from = new Date(now.getTime() - days * 86_400_000)
  const to = endOfDayInZone(now, CALENDAR_TIME_ZONE)

  // Newest first: an admin almost always wants the meeting that just happened.
  return collect(events, { from, to, perSeries: 24 }).reverse()
}
