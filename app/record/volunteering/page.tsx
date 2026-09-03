import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { VolunteeringForm } from "@/components/forms/volunteering-form"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"

export default async function RecordVolunteeringPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader title="Record Volunteering" subtitle="Hours you gave back to the community." backHref="/" />
      <VolunteeringForm />
    </AppShell>
  )
}
