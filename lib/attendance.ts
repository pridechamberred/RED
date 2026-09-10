import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  CALENDAR_TIME_ZONE,
  getMeetingsBetween,
  getRecentMeetings,
  subGroupFromTitle,
  REGISTER_WINDOW_DAYS,
} from "@/lib/calendar"
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
  /**
   * Free-text name of the stand-in, when status is `substitute` and an admin
   * typed one. Null in every other case — the DB constraint guarantees a name
   * cannot linger on a non-substitute row.
   */
  substituteName: string | null
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
  substitute_name: string | null
}

type Mark = { status: AttendanceStatus; substituteName: string | null }

/**
 * Existing marks for a meeting, keyed by `m:<memberId>` / `g:<guestId>`.
 *
 * Returns an empty map (everything "not recorded") if the table is unavailable,
 * so a missing migration degrades to a blank register rather than a crash. The
 * `substitute_name` select is likewise tolerant: if column 012 has not been
 * applied yet the query errors and we fall back to statuses without names,
 * rather than the whole register failing to load.
 */
async function getMarks(meetingId: string): Promise<Map<string, Mark>> {
  const supabase = await createClient()
  const marks = new Map<string, Mark>()

  const withName = await supabase
    .from("meeting_attendance")
    .select("member_id, guest_invitation_id, status, substitute_name")
    .eq("meeting_uid", meetingId)

  // Pre-012 fallback: retry without the new column so a register still renders.
  const result = withName.error
    ? await supabase
        .from("meeting_attendance")
        .select("member_id, guest_invitation_id, status")
        .eq("meeting_uid", meetingId)
    : withName

  if (result.error) {
    console.error("getMarks error:", result.error.message)
    return marks
  }

  for (const row of (result.data ?? []) as AttendanceRow[]) {
    const key = row.member_id ? `m:${row.member_id}` : `g:${row.guest_invitation_id}`
    marks.set(key, { status: row.status, substituteName: row.substitute_name ?? null })
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

  const members: RosterEntry[] = ((membersResult.data ?? []) as MemberRow[]).map((m) => {
    const mark = marks.get(`m:${m.id}`)
    return {
      id: m.id,
      name: memberName(m),
      detail: m.company,
      status: mark?.status ?? null,
      substituteName: mark?.substituteName ?? null,
    }
  })

  const guests: GuestEntry[] = ((guestsResult.data ?? []) as unknown as GuestRow[]).map((g) => ({
    id: g.id,
    name: g.guest_name,
    detail: g.guest_email,
    invitedBy: g.inviter ? memberName(g.inviter) : "a member",
    // Guests are never substitutes, so this is always null for them.
    status: marks.get(`g:${g.id}`)?.status ?? null,
    substituteName: null,
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

/** Meetings inside an arbitrary date range, with each one's sub-group resolved. */
export async function getReportMeetings(fromDate: string, toDate: string): Promise<RegisterMeeting[]> {
  const meetings = await getMeetingsBetween(fromDate, toDate)
  return meetings.map(withSubGroup)
}

/** One member's attendance tally across a sub-group's meetings in the range. */
export type MemberAttendanceReportRow = {
  memberId: string
  name: string
  company: string | null
  /** Meetings the sub-group held in range — the same for every member of it. */
  held: number
  attended: number
  substitute: number
  absent: number
  /** Held meetings with no register row for this member. Never negative. */
  notRegistered: number
}

/** The attendance report for a single sub-group. */
export type SubGroupAttendanceReport = {
  subGroup: SubGroup
  meetingsHeld: number
  members: MemberAttendanceReportRow[]
}

type ReportMemberRow = {
  id: string
  first_name: string
  last_name: string
  company: string | null
  sub_group: SubGroup
}

/**
 * Attendance-by-member report for one or more sub-groups over a date range.
 *
 * "Meetings held" comes from the calendar (what actually happened), while the
 * per-status counts come from the register. A meeting with no register row for
 * a member is counted as "not registered" — deliberately distinct from a
 * recorded absence, matching how `AttendanceMark` models a missing row as null.
 *
 * `substitute` is reported on its own and never folded into attended or absent,
 * consistent with the rest of the attendance feature.
 *
 * `subGroups` is passed by the caller so role scoping stays in one place: a
 * sub-group admin asks only for their own group, a super-admin for any subset.
 */
export async function getAttendanceReport(opts: {
  fromDate: string
  toDate: string
  subGroups: SubGroup[]
}): Promise<SubGroupAttendanceReport[]> {
  const { fromDate, toDate, subGroups } = opts
  if (subGroups.length === 0) return []

  const scope = new Set(subGroups)
  const meetings = await getReportMeetings(fromDate, toDate)

  // Group in-scope meeting ids by sub-group. Meetings whose title matches no
  // sub-group carry a null group and are dropped — there is no roster for them.
  const meetingIdsByGroup = new Map<SubGroup, string[]>()
  for (const g of subGroups) meetingIdsByGroup.set(g, [])
  for (const m of meetings) {
    if (m.subGroup && scope.has(m.subGroup)) meetingIdsByGroup.get(m.subGroup)!.push(m.id)
  }
  const allMeetingIds = [...meetingIdsByGroup.values()].flat()

  const supabase = await createClient()

  // key `${meeting_uid}:${member_id}` -> status, fetched in chunks so a wide
  // range with hundreds of meetings stays under a sane query-string length.
  const statusByKey = new Map<string, AttendanceStatus>()
  const CHUNK = 150
  for (let i = 0; i < allMeetingIds.length; i += CHUNK) {
    const slice = allMeetingIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("meeting_attendance")
      .select("meeting_uid, member_id, status")
      .in("meeting_uid", slice)
      .not("member_id", "is", null)

    if (error) {
      console.error("getAttendanceReport attendance error:", error.message)
      continue
    }
    for (const row of (data ?? []) as { meeting_uid: string; member_id: string; status: AttendanceStatus }[]) {
      statusByKey.set(`${row.meeting_uid}:${row.member_id}`, row.status)
    }
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("id, first_name, last_name, company, sub_group")
    .in("sub_group", subGroups)
    .order("first_name")

  if (memberError) console.error("getAttendanceReport members error:", memberError.message)
  const members = (memberData ?? []) as ReportMemberRow[]

  // Preserve the caller's sub-group order in the output.
  return subGroups.map((group) => {
    const meetingIds = meetingIdsByGroup.get(group) ?? []
    const rows: MemberAttendanceReportRow[] = members
      .filter((m) => m.sub_group === group)
      .map((m) => {
        let attended = 0
        let substitute = 0
        let absent = 0
        for (const meetingId of meetingIds) {
          switch (statusByKey.get(`${meetingId}:${m.id}`)) {
            case "attended":
              attended += 1
              break
            case "substitute":
              substitute += 1
              break
            case "absent":
              absent += 1
              break
            // undefined -> no register row -> counted as not registered below.
          }
        }
        return {
          memberId: m.id,
          name: memberName(m),
          company: m.company,
          held: meetingIds.length,
          attended,
          substitute,
          absent,
          notRegistered: meetingIds.length - attended - substitute - absent,
        }
      })

    return { subGroup: group, meetingsHeld: meetingIds.length, members: rows }
  })
}
