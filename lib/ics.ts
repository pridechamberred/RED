import "server-only"

import type { MeetingOption } from "@/lib/meeting-options"

/**
 * "Add to calendar" for a guest who has just registered.
 *
 * Two routes are offered because phones differ: an .ics download (works with
 * Apple Calendar and Outlook, which is most iPhones) and a Google Calendar
 * template URL (one tap for anyone already signed into Google).
 */

/**
 * How long to block out, in minutes.
 *
 * The Google Calendar feed publishes RRULE-based recurring events and this app's
 * parser reads DTSTART only, so no end time is available here. RED meetings run
 * about 90 minutes, so that is what a guest's calendar reserves. Worst case the
 * block is slightly wrong; it never affects the meeting itself or the record in
 * the database.
 */
const DEFAULT_DURATION_MINUTES = 90

/** ICS timestamps are basic-format UTC: 20260908T153000Z */
function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`
}

/** Escapes a text value per RFC 5545 (backslash first, or it double-escapes). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/**
 * Folds a content line to 75 octets, as RFC 5545 requires.
 *
 * Long venue addresses routinely exceed this, and some desktop clients reject
 * the whole file rather than the offending line. Measured in UTF-8 bytes, not
 * characters, so a multi-byte character is never split down the middle.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ""
  let currentBytes = 0

  for (const char of line) {
    const charBytes = encoder.encode(char).length
    // Continuation lines start with a space, which itself costs an octet.
    const limit = out.length === 0 ? 75 : 74

    if (currentBytes + charBytes > limit) {
      out.push(current)
      current = char
      currentBytes = charBytes
    } else {
      current += char
      currentBytes += charBytes
    }
  }
  if (current.length > 0) out.push(current)

  return out.join("\r\n ")
}

/** A single-event .ics file for one meeting. */
export function buildMeetingIcs(meeting: MeetingOption, hostName: string | null): string {
  const start = new Date(meeting.startISO)
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000)

  const description = hostName
    ? `You're attending as a guest of ${hostName}. Bring plenty of business cards!`
    : "You're registered as a guest at this RED Group meeting."

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RED Group//Guest Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Derived from the occurrence id so re-downloading updates the same entry
    // rather than creating a duplicate. Non-alphanumerics stripped because the
    // raw id contains characters some clients mishandle in a UID.
    `UID:${meeting.id.replace(/[^a-zA-Z0-9]/g, "")}@redgroup`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(meeting.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    ...(meeting.location ? [`LOCATION:${escapeIcsText(meeting.location)}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  // CRLF endings: RFC 5545 mandates them and stricter desktop clients enforce it.
  return `${lines.map(foldLine).join("\r\n")}\r\n`
}

/** Google Calendar "add event" template URL — no download, just a tap. */
export function buildGoogleCalendarUrl(meeting: MeetingOption, hostName: string | null): string {
  const start = new Date(meeting.startISO)
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000)

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${toIcsUtc(start)}/${toIcsUtc(end)}`,
    details: hostName
      ? `You're attending as a guest of ${hostName}. Bring plenty of business cards!`
      : "You're registered as a guest at this RED Group meeting.",
  })
  if (meeting.location) params.set("location", meeting.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
