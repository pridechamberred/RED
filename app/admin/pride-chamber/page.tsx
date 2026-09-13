import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { PrideChamberAdmin } from "@/components/pride-chamber-admin"
import { getCurrentMember, getEligiblePrideChamberEvents } from "@/lib/data"
import { getRecentSyncRuns } from "@/lib/pride-chamber-sync"
import { isAdmin } from "@/lib/types"

export default async function PrideChamberAdminPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  const [events, runs] = await Promise.all([getEligiblePrideChamberEvents(), getRecentSyncRuns()])

  return (
    <AppShell showAdmin>
      <FormHeader
        title="Pride Chamber events"
        subtitle="Imported daily from the chamber's public calendar for the attendance form."
        backHref="/admin"
        backLabel="Admin"
      />
      <PrideChamberAdmin events={events} runs={runs} />
    </AppShell>
  )
}
