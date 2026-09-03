import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ActivityList } from "@/components/activity-list"
import { FormHeader } from "@/components/form-header"
import { getActivityFeed, getCurrentMember, getMemberById, getReferralsReceivedCount } from "@/lib/data"
import { formatMoney, isAdmin, memberName } from "@/lib/types"

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  const member = await getMemberById(id)
  if (!member) notFound()

  // An admin may only inspect members inside their own sub-group.
  if (me.role === "admin" && member.sub_group !== me.sub_group) redirect("/admin")

  const [rows, referralsReceived] = await Promise.all([
    getActivityFeed(member.id),
    getReferralsReceivedCount(member.id),
  ])

  const summary = {
    vous: 0,
    referralsGiven: 0,
    doneDeals: 0,
    dealValue: 0,
    volunteeringHours: 0,
    chamberEvents: 0,
  }

  for (const row of rows) {
    if (row.type === "vous") summary.vous += 1
    if (row.type === "referral") summary.referralsGiven += 1
    if (row.type === "done_deal") {
      summary.doneDeals += 1
      summary.dealValue += row.value ?? 0
    }
    if (row.type === "volunteering") summary.volunteeringHours += row.hours ?? 0
    if (row.type === "chamber_event") summary.chamberEvents += 1
  }

  const stats = [
    { label: "Vous", value: String(summary.vous) },
    { label: "Referrals given", value: String(summary.referralsGiven) },
    { label: "Referrals received", value: String(referralsReceived) },
    { label: "Done Deals", value: String(summary.doneDeals) },
    { label: "Deal value", value: formatMoney(summary.dealValue) },
    { label: "Volunteering", value: `${Math.round(summary.volunteeringHours * 100) / 100} hrs` },
    { label: "Chamber events", value: String(summary.chamberEvents) },
  ]

  return (
    <AppShell showAdmin>
      <FormHeader
        title={memberName(member)}
        subtitle={member.company ? `${member.company} · ${member.sub_group}` : member.sub_group}
        backHref="/admin"
        backLabel="Admin"
      />

      <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-3.5 py-3">
            <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className="truncate text-lg font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Activity history</h2>
        <ActivityList rows={rows} emptyMessage="This member hasn't recorded anything yet." />
      </section>
    </AppShell>
  )
}
