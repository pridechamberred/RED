import "server-only"

import { getMeetingsBetween, subGroupFromTitle } from "@/lib/calendar"
import { EASTERN_TIME_ZONE, easternTodayISO, shiftISODate } from "@/lib/eastern-date"
import { sendMeetingEveReminderEmail } from "@/lib/email"
import { CANONICAL_SITE_URL } from "@/lib/site-url"
import { createAdminClient } from "@/lib/supabase/admin"

/** Local Eastern hour at which the reminder goes out. */
export const REMINDER_HOUR_ET = 18

/** Resend's default limit is 2 requests/second, so pace sends just under it. */
const SEND_GAP_MS = 600

export type ReminderRunSummary = {
  ok: boolean
  skipped?: string
  tomorrow?: string
  meetings: { title: string; subGroup: string | null; sent: number; alreadySent: number; failed: number }[]
  error?: string
}

function easternHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now),
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Emails every member of each sub-group that meets tomorrow (Eastern).
 *
 * Vercel crons run on UTC, so the job is scheduled at both 22:00 and 23:00 UTC
 * and only proceeds when it is actually the 6pm hour in New York — that covers
 * EDT and EST without anyone editing the schedule twice a year. Each send is
 * claimed in `meeting_reminder_sends` first, so a retried or doubled run never
 * emails the same member twice for the same meeting.
 */
export async function runMeetingEveReminders(now: Date = new Date()): Promise<ReminderRunSummary> {
  if (easternHour(now) !== REMINDER_HOUR_ET) {
    return { ok: true, skipped: `Not ${REMINDER_HOUR_ET}:00 in New York`, meetings: [] }
  }

  const tomorrow = shiftISODate(easternTodayISO(now), 1)
  const summary: ReminderRunSummary = { ok: true, tomorrow, meetings: [] }

  let meetings
  try {
    meetings = await getMeetingsBetween(tomorrow, tomorrow)
  } catch (err) {
    return { ok: false, tomorrow, meetings: [], error: err instanceof Error ? err.message : String(err) }
  }

  const supabase = createAdminClient()
  const logUrl = `${CANONICAL_SITE_URL}/`
  // A member in two groups that both meet tomorrow gets one reminder, not two.
  const remindedThisRun = new Set<string>()

  for (const meeting of meetings) {
    const subGroup = subGroupFromTitle(meeting.title)
    const result = { title: meeting.title, subGroup, sent: 0, alreadySent: 0, failed: 0 }
    summary.meetings.push(result)
    if (!subGroup) continue

    const { data: members, error } = await supabase
      .from("members")
      .select("id, first_name, email")
      .contains("sub_groups", [subGroup])

    if (error) {
      console.error(`[v0] meeting reminders: could not load ${subGroup} members:`, error.message)
      summary.ok = false
      summary.error = error.message
      continue
    }

    for (const member of members ?? []) {
      if (!member.email || remindedThisRun.has(member.id)) continue

      const { data: claimed, error: claimError } = await supabase
        .from("meeting_reminder_sends")
        .upsert({ meeting_id: meeting.id, member_id: member.id }, { onConflict: "meeting_id,member_id", ignoreDuplicates: true })
        .select("member_id")

      if (claimError) {
        console.error("[v0] meeting reminders: claim failed:", claimError.message)
        summary.ok = false
        summary.error = claimError.message
        result.failed++
        continue
      }
      if (!claimed?.length) {
        result.alreadySent++
        remindedThisRun.add(member.id)
        continue
      }

      remindedThisRun.add(member.id)
      const delivery = await sendMeetingEveReminderEmail({
        to: member.email,
        firstName: member.first_name,
        subGroup,
        logUrl,
      })

      if (delivery.sent) {
        result.sent++
      } else {
        result.failed++
        // Release the claim so a later run can retry this member.
        await supabase
          .from("meeting_reminder_sends")
          .delete()
          .eq("meeting_id", meeting.id)
          .eq("member_id", member.id)
      }
      await sleep(SEND_GAP_MS)
    }
  }

  return summary
}
