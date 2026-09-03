import "server-only"

import { CALENDAR_TIME_ZONE, getUpcomingMeetings, subGroupFromTitle } from "@/lib/calendar"
import type { SubGroup } from "@/lib/types"

/** How many upcoming meetings the guest-invite dropdown offers. */
export const MEETING_OPTION_LIMIT = 30

export type MeetingOption = {
  /** Opaque key the client sends back. */
  id: string
  /** e.g. "RED Central — Tue, Sep 8, 11:30 AM EDT" */
  label: string
  /** Resolved from the event title, or null when it matches no sub-group. */
  subGroup: SubGroup | null
  startISO: string
  title: string
  location: string | null
}

const labelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

/**
 * The next meetings, shaped for a <select>.
 *
 * Both the form and `inviteGuest` call this. The form must never be trusted to
 * send back the title, venue or group — a tampered POST could then store any
 * text it liked, or file a guest under a group the meeting doesn't belong to.
 * Instead the client returns only `id` and the action re-derives the rest here.
 */
export async function getMeetingOptions(limit = MEETING_OPTION_LIMIT): Promise<MeetingOption[]> {
  const meetings = await getUpcomingMeetings(limit)

  return meetings.map((meeting) => ({
    id: meeting.id,
    label: `${meeting.title} — ${labelFormat.format(new Date(meeting.startISO))}`,
    subGroup: subGroupFromTitle(meeting.title),
    startISO: meeting.startISO,
    title: meeting.title,
    location: meeting.location,
  }))
}
