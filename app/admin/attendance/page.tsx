import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, CalendarX2, MapPin } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { getCurrentMember } from "@/lib/data"
import {
  getRegisterMeetings,
  getRegisterSummaries,
  meetingDateFormat,
  REGISTER_WINDOW_DAYS,
  type RegisterSummary,
} from "@/lib/attendance"
import { isAdmin } from "@/lib/types"

/**
 * "8 attended · 2 absent · 1 substitute".
 *
 * Substitutes are reported as their own figure, never merged into attended or
 * absent. The segment is omitted entirely when the count is zero, so the common
 * case stays as short as it was before substitutes existed.
 */
function summarise(summary: RegisterSummary): string {
  const parts = [`${summary.attended} attended`, `${summary.absent} absent`]
  if (summary.substitute > 0) {
    parts.push(`${summary.substitute} substitute`)
  }
  return parts.join(" · ")
}

/**
 * The status line under each meeting.
 *
 * This line describes the **register**, never the meeting itself. The previous
 * copy ("Not started") sat directly beneath the date and location — both facts
 * about the meeting — so it read as "this meeting hasn't started yet", which was
 * actively misleading for a meeting that had already happened. It only ever
 * meant "no attendance rows exist".
 *
 * The distinction matters because the register window runs to the *end of
 * today* (so a register can be filled in on the morning of a meeting). An
 * unrecorded meeting is therefore either still to come — nothing owed yet — or
 * in the past and genuinely outstanding. Those two cases now read differently,
 * and only the outstanding one gets the accent colour.
 */
function registerStatus(
  summary: RegisterSummary | undefined,
  meeting: { startISO: string },
  now: Date,
): { label: string; outstanding: boolean } {
  if (summary) return { label: summarise(summary), outstanding: false }

  const hasHappened = new Date(meeting.startISO).getTime() <= now.getTime()
  return hasHappened
    ? { label: "Register not taken", outstanding: true }
    : { label: "Starts later today", outstanding: false }
}

export default async function AttendanceIndexPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  // One timestamp for both the window and the labels, so a meeting can't be
  // selected against one clock reading and then described against a later one.
  const now = new Date()
  const all = await getRegisterMeetings(now)

  // A sub-group admin only registers their own group's meetings. Meetings whose
  // title matches no sub-group are dropped: there is no roster to show.
  const meetings =
    me.role === "super-admin" ? all.filter((m) => m.subGroup) : all.filter((m) => m.subGroup === me.sub_group)

  const summaries = await getRegisterSummaries(meetings)

  return (
    <AppShell showAdmin>
      <FormHeader
        title="Attendance Record"
        subtitle={
          me.role === "super-admin"
            ? `Meetings from the last ${REGISTER_WINDOW_DAYS} days, across all sub-groups.`
            : `${me.sub_group} meetings from the last ${REGISTER_WINDOW_DAYS} days.`
        }
        backHref="/admin"
        backLabel="Admin"
      />

      {meetings.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          >
            <CalendarX2 className="size-5" />
          </span>
          <p className="font-semibold">No meetings to display</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {`Nothing in the calendar over the last ${REGISTER_WINDOW_DAYS} days. Registers appear here on the morning of each meeting.`}
          </p>
        </div>
      ) : (
        <ul className="mt-7 flex flex-col gap-2.5">
          {meetings.map((meeting) => {
            const status = registerStatus(summaries.get(meeting.id), meeting, now)
            return (
              <li key={meeting.id}>
                <Link
                  href={`/admin/attendance/${encodeURIComponent(meeting.id)}`}
                  className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-accent/60"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-bold uppercase tracking-[0.06em]">{meeting.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {meetingDateFormat.format(new Date(meeting.startISO))}
                    </span>
                    {meeting.location ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{meeting.location}</span>
                      </span>
                    ) : null}
                    <span
                      className={
                        status.outstanding
                          ? "text-xs font-semibold text-primary"
                          : "text-xs font-medium text-muted-foreground"
                      }
                    >
                      {status.label}
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
