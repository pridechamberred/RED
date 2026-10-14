import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { MyActivityFeed } from "@/components/my-activity-feed"
import { getLastMeetingForGroups } from "@/lib/calendar"
import { getActivityFeed, getCurrentMember } from "@/lib/data"
import { easternTodayISO, formatLongDate } from "@/lib/eastern-date"
import { isAdmin, resolveSubGroups } from "@/lib/types"

export default async function MyActivityPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const [rows, lastMeeting] = await Promise.all([
    getActivityFeed(me.id),
    getLastMeetingForGroups(resolveSubGroups(me)),
  ])

  const sinceLastMeeting = lastMeeting
    ? (() => {
        const from = easternTodayISO(new Date(lastMeeting.startISO))
        return {
          label: `Since the last ${lastMeeting.subGroup} meeting on ${formatLongDate(from)}`,
          from,
          to: easternTodayISO(),
        }
      })()
    : null

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">My Activity</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {rows.length === 0
            ? "Everything you record shows up here."
            : `${rows.length} ${rows.length === 1 ? "activity" : "activities"} recorded.`}
        </p>
      </header>

      <div className="mt-6">
        <MyActivityFeed rows={rows} defaultRange={sinceLastMeeting} />
      </div>
    </AppShell>
  )
}
