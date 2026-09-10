import { redirect } from "next/navigation"
import { CalendarX2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { AttendanceReportFilters } from "@/components/attendance-report-filters"
import { getCurrentMember } from "@/lib/data"
import { getAttendanceReport, type MemberAttendanceReportRow } from "@/lib/attendance"
import { SUB_GROUPS, type SubGroup, formatDate, isAdmin, todayISO } from "@/lib/types"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Default window: a rolling ~6 months, enough for several monthly meetings. */
const DEFAULT_RANGE_DAYS = 180

function shiftISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** The five numeric columns, paired with the full label screen readers get. */
const COLUMNS: { key: keyof Pick<MemberAttendanceReportRow, "held" | "attended" | "substitute" | "absent" | "notRegistered">; short: string; full: string }[] = [
  { key: "held", short: "Held", full: "Meetings held" },
  { key: "attended", short: "Att.", full: "Attended" },
  { key: "substitute", short: "Sub.", full: "Substitute" },
  { key: "absent", short: "Abs.", full: "Absent" },
  { key: "notRegistered", short: "N/R", full: "Not registered" },
]

function num(value: number) {
  return (
    <span className={value === 0 ? "text-muted-foreground/50" : "font-semibold tabular-nums"}>{value}</span>
  )
}

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group?: string }>
}) {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  const params = await searchParams

  const today = todayISO()
  const from = params.from && ISO_DATE.test(params.from) ? params.from : shiftISODate(today, -DEFAULT_RANGE_DAYS)
  const to = params.to && ISO_DATE.test(params.to) ? params.to : today

  // A sub-group admin is locked to their own group; only a super-admin may pick.
  const requestedGroup = SUB_GROUPS.includes(params.group as SubGroup) ? (params.group as SubGroup) : null
  const allowedForRole: SubGroup[] = me.role === "super-admin" ? [...SUB_GROUPS] : [me.sub_group]
  const activeGroup = requestedGroup && allowedForRole.includes(requestedGroup) ? requestedGroup : null
  const subGroups = activeGroup ? [activeGroup] : allowedForRole

  const report = await getAttendanceReport({ fromDate: from, toDate: to, subGroups })

  // When a specific group is chosen, always show it (with a note if empty) so
  // the page never looks broken. Across all groups, hide the ones with no
  // meetings in range rather than stacking identical empty notes.
  const visible = activeGroup ? report : report.filter((r) => r.meetingsHeld > 0)

  return (
    <AppShell showAdmin>
      <FormHeader
        title="Attendance Report"
        subtitle={
          me.role === "super-admin"
            ? "RED meeting attendance by member."
            : `${me.sub_group} meeting attendance by member.`
        }
        backHref="/admin"
        backLabel="Admin"
      />

      <div className="mt-6 flex flex-col gap-6">
        <AttendanceReportFilters
          from={from}
          to={to}
          group={activeGroup}
          canFilterSubGroup={me.role === "super-admin"}
        />

        <p className="text-xs font-medium text-muted-foreground">
          {`Meetings from ${formatDate(from)} to ${formatDate(to)}, from the RED calendar.`}
        </p>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            >
              <CalendarX2 className="size-5" />
            </span>
            <p className="font-semibold">No meetings in this range</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No RED meetings fell between these dates. Try widening the date range.
            </p>
          </div>
        ) : (
          visible.map((group) => {
            const totals = group.members.reduce(
              (acc, m) => ({
                attended: acc.attended + m.attended,
                substitute: acc.substitute + m.substitute,
                absent: acc.absent + m.absent,
                notRegistered: acc.notRegistered + m.notRegistered,
              }),
              { attended: 0, substitute: 0, absent: 0, notRegistered: 0 },
            )

            return (
              <section key={group.subGroup} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-bold uppercase tracking-[0.06em]">{group.subGroup}</h2>
                  <p className="text-xs text-muted-foreground">
                    {`${group.meetingsHeld} ${group.meetingsHeld === 1 ? "meeting" : "meetings"} held · ${group.members.length} ${group.members.length === 1 ? "member" : "members"}`}
                  </p>
                </div>

                {group.meetingsHeld === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    No RED meetings for this group in the selected range.
                  </p>
                ) : group.members.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    No members in this group yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full border-collapse text-sm">
                      <caption className="sr-only">
                        {`${group.subGroup} attendance by member from ${formatDate(from)} to ${formatDate(to)}`}
                      </caption>
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                            Member
                          </th>
                          {COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              scope="col"
                              title={col.full}
                              className="px-2 py-2.5 text-right font-semibold last:pr-3"
                            >
                              <span aria-hidden>{col.short}</span>
                              <span className="sr-only">{col.full}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.members.map((m) => (
                          <tr key={m.memberId} className="border-b border-border/60 last:border-0">
                            <th scope="row" className="max-w-[10rem] truncate px-3 py-2.5 text-left font-medium">
                              {m.name}
                            </th>
                            <td className="px-2 py-2.5 text-right tabular-nums">{num(m.held)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{num(m.attended)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{num(m.substitute)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{num(m.absent)}</td>
                            <td className="px-2 py-2.5 pr-3 text-right tabular-nums">{num(m.notRegistered)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-secondary/40">
                          <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                            All members
                          </th>
                          <td className="px-2 py-2.5 text-right text-muted-foreground" aria-label="Not applicable">
                            —
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{totals.attended}</td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{totals.substitute}</td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{totals.absent}</td>
                          <td className="px-2 py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {totals.notRegistered}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
