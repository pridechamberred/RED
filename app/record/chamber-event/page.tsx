import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { ChamberEventForm } from "@/components/forms/chamber-event-form"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"

export default async function RecordChamberEventPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader title="Record Chamber Event" subtitle="An event you attended." backHref="/" />
      <ChamberEventForm />
    </AppShell>
  )
}
