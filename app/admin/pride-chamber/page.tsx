import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { PrideChamberAdmin } from "@/components/pride-chamber-admin"
import { getCurrentMember, getEligiblePrideChamberEvents } from "@/lib/data"
import { getManualPrideChamberEvents, getRecentSyncRuns } from "@/lib/pride-chamber-sync"
import { easternTodayISO } from "@/lib/eastern-date"
import { isAdmin } from "@/lib/types"

export default async function PrideChamberAdminPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  const [events, runs, manualEvents] = await Promise.all([
    getEligiblePrideChamberEvents(),
    getRecentSyncRuns(),
    getManualPrideChamberEvents(),
  ])

  return (
    <AppShell showAdmin>
      <FormHeader
        title="Pride Chamber events"
        subtitle="Imported daily from the chamber's public calendar for the attendance form."
        backHref="/admin"
        backLabel="Admin"
      />
      <PrideChamberAdmin events={events} runs={runs} manualEvents={manualEvents} today={easternTodayISO()} />
    </AppShell>
  )
}
