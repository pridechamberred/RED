import "server-only"

import { createClient } from "@/lib/supabase/server"
import { CALENDAR_TIME_ZONE, getRecentMeetings, subGroupFromTitle, REGISTER_WINDOW_DAYS } from "@/lib/calendar"
import { memberName, type SubGroup } from "@/lib/types"
import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance-status"

export { REGISTER_WINDOW_DAYS }

/** A calendar meeting that is eligible for a register, with its group resolved. */
export type RegisterMeeting = {
  id: string
  startISO: string
  title: string
  location: string | null
  /** Null when the event title matches no sub-group — no roster can be built. */
  subGroup: SubGroup | null
}

// The status vocabulary lives in a client-safe module — see the note there for
// why it must not be defined in this `server-only` file. Re-exported so server
// callers can keep importing everything attendance-related from one place.
export type { AttendanceStatus, AttendanceMark } from "@/lib/attendance-status"
export { MEMBER_STATUSES, GUEST_STATUSES, STATUS_LABEL } from "@/lib/attendance-status"

export type RosterEntry = {
  id: string
  name: string
  detail: string | null
  status: AttendanceMark
}

export type GuestEntry = RosterEntry & { invitedBy: string }

export const meetingDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

function withSubGroup(meeting: {
  id: string
  startISO: string
  title: string
  location: string | null
}): RegisterMeeting {
  return { ...meeting, subGroup: subGroupFromTitle(meeting.title) }
}

/** Meetings from the last {@link REGISTER_WINDOW_DAYS} days, newest first. */
export async function getRegisterMeetings(now?: Date): Promise<RegisterMeeting[]> {
  const meetings = await getRecentMeetings(now)
  return meetings.map(withSubGroup)
}

/**
 * Looks up one eligible meeting by id.
 *
 * Deliberately re-derived from the calendar rather than taken from the request:
 * that both validates the id is a real meeting inside the register window and
 * recovers its group, title and time without trusting the client.
 */
export async function findRegisterMeeting(id: string, now?: Date): Promise<RegisterMeeting | null> {
  const meetings = await getRegisterMeetings(now)
  return meetings.find((m) => m.id === id) ?? null
}

type AttendanceRow = {
  member_id: string | null
  guest_invitation_id: string | null
  status: AttendanceStatus
}

/**
 * Existing marks for a meeting, keyed by `m:<memberId>` / `g:<guestId>`.
 *
 * Returns an empty map (everything "not recorded") if the table is unavailable,
 * so a missing migration degrades to a blank register rather than a crash.
 */
async function getMarks(meetingId: string): Promise<Map<string, AttendanceStatus>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("meeting_attendance")
    .select("member_id, guest_invitation_id, status")
    .eq("meeting_uid", meetingId)

  if (error) {
    console.error("getMarks error:", error.message)
    return new Map()
  }

  const marks = new Map<string, AttendanceStatus>()
  for (const row of (data ?? []) as AttendanceRow[]) {
    const key = row.member_id ? `m:${row.member_id}` : `g:${row.guest_invitation_id}`
    marks.set(key, row.status)
  }
  return marks
}

type MemberRow = { id: string; first_name: string; last_name: string; company: string | null }

type GuestRow = {
  id: string
  guest_name: string
  guest_email: string
  inviter: { first_name: string; last_name: string } | null
}

/**
 * The full register for one meeting: every member of its sub-group, plus every
 * guest invited to that specific occurrence.
 */
export async function getRegister(meeting: RegisterMeeting): Promise<{
  members: RosterEntry[]
  guests: GuestEntry[]
}> {
  if (!meeting.subGroup) return { members: [], guests: [] }

  const supabase = await createClient()

  const [marks, membersResult, guestsResult] = await Promise.all([
    getMarks(meeting.id),
    supabase
      .from("members")
      .select("id, first_name, last_name, company")
      .eq("sub_group", meeting.subGroup)
      .order("first_name"),
    // Guests are matched on the occurrence id, so a guest invited to September's
    // meeting does not appear on October's register for the same series.
    supabase
      .from("guest_invitations")
      .select("id, guest_name, guest_email, inviter:members!guest_invitations_inviter_user_id_fkey(first_name, last_name)")
      .eq("meeting_uid", meeting.id)
      .order("created_at"),
  ])

  if (membersResult.error) console.error("getRegister members error:", membersResult.error.message)
  if (guestsResult.error) console.error("getRegister guests error:", guestsResult.error.message)

  const members: RosterEntry[] = ((membersResult.data ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    name: memberName(m),
    detail: m.company,
    status: marks.get(`m:${m.id}`) ?? null,
  }))

  const guests: GuestEntry[] = ((guestsResult.data ?? []) as unknown as GuestRow[]).map((g) => ({
    id: g.id,
    name: g.guest_name,
    detail: g.guest_email,
    invitedBy: g.inviter ? memberName(g.inviter) : "a member",
    status: marks.get(`g:${g.id}`) ?? null,
  }))

  return { members, guests }
}

/**
 * Per-status counts for the meeting list.
 *
 * `substitute` is tracked separately rather than being added to `attended` or
 * `absent`, so the summary line stays able to report all three and either rule
 * can still be derived downstream. `total` is the number of people ruled on —
 * not the roster size, since "not recorded" has no row.
 */
export type RegisterSummary = { attended: number; absent: number; substitute: number; total: number }

/**
 * Per-meeting tallies for a batch of meetings, in one query rather than one per
 * meeting.
 */
export async function getRegisterSummaries(
  meetings: RegisterMeeting[],
): Promise<Map<string, RegisterSummary>> {
  const summaries = new Map<string, RegisterSummary>()
  if (meetings.length === 0) return summaries

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("meeting_attendance")
    .select("meeting_uid, status")
    .in(
      "meeting_uid",
      meetings.map((m) => m.id),
    )

  if (error) {
    console.error("getRegisterSummaries error:", error.message)
    return summaries
  }

  for (const row of (data ?? []) as { meeting_uid: string; status: AttendanceStatus }[]) {
    const current =
      summaries.get(row.meeting_uid) ?? { attended: 0, absent: 0, substitute: 0, total: 0 }
    // Switch rather than an if/else on a boolean, so an unrecognised status is
    // skipped loudly-ish instead of being silently counted as absent.
    switch (row.status) {
      case "attended":
        current.attended += 1
        break
      case "absent":
        current.absent += 1
        break
      case "substitute":
        current.substitute += 1
        break
      default:
        console.error("getRegisterSummaries: unknown status", row.status)
        continue
    }
    current.total += 1
    summaries.set(row.meeting_uid, current)
  }

  return summaries
}
