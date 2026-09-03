import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { DoneDealsRecord } from "@/components/done-deals-record"
import { getCurrentMember, getMyDoneDeals, getSearchableMembers } from "@/lib/data"
import { isAdmin, todayISO } from "@/lib/types"

export default async function DoneDealsRecordPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  // Totals are accrued as at today, scoped to the current calendar year.
  const year = Number(todayISO().slice(0, 4))
  // Members populate the "referral from" dropdown. getSearchableMembers already
  // excludes the caller — you cannot be referred by yourself — and spans every
  // sub-group, not just the caller's own.
  const [deals, members] = await Promise.all([getMyDoneDeals(me.id, year), getSearchableMembers(me.id)])

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader
        title="Done Deals Record"
        subtitle="Keep track of closed business this year"
        backHref="/"
        backLabel="Home"
      />
      <div className="mt-6">
        <DoneDealsRecord deals={deals} year={year} members={members} />
      </div>
    </AppShell>
  )
}
