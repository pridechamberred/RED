import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ActivityList } from "@/components/activity-list"
import { getActivityFeed, getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"

export default async function MyActivityPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const rows = await getActivityFeed(me.id)

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
        <ActivityList rows={rows} emptyMessage="Nothing recorded yet. Search a member on the home screen to start." />
      </div>
    </AppShell>
  )
}
