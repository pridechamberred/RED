import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { GuestInviteForm, type MeetingChoice } from "@/components/forms/guest-invite-form"
import { getCurrentMember } from "@/lib/data"
import { getMeetingOptions } from "@/lib/meeting-options"
import { isAdmin } from "@/lib/types"

export default async function InviteGuestPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  // Only id/label/subGroup reach the browser. The action re-reads the calendar
  // to recover the title, time and venue, so nothing sensitive rides on the
  // client's copy.
  const meetings: MeetingChoice[] = (await getMeetingOptions()).map(({ id, label, subGroup }) => ({
    id,
    label,
    subGroup,
  }))

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader
        title="Invite a Guest to RED"
        subtitle="Bring someone along to a sub-group meeting."
        backHref="/"
      />
      <GuestInviteForm defaultSubGroup={me.sub_group} meetings={meetings} />
    </AppShell>
  )
}
