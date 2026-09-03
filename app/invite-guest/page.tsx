import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { GuestInviteForm, type MeetingChoice } from "@/components/forms/guest-invite-form"
import { InviteGuestTabs } from "@/components/invite-guest-tabs"
import { InviteQrPanel } from "@/components/invite-qr-panel"
import { getCurrentMember } from "@/lib/data"
import { buildInviteQrSvg, buildInviteUrl } from "@/lib/invite-link"
import { getMeetingOptions } from "@/lib/meeting-options"
import { isAdmin, memberName } from "@/lib/types"

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

  // `getCurrentMember` selects *, so the token simply arrives once migration
  // 011 has been run and is absent until then. Treated as "no QR yet" rather
  // than an error so the manual invite path keeps working either way.
  const token = me.invite_token ?? null
  const inviteUrl = token ? await buildInviteUrl(token) : null
  const qrSvg = inviteUrl ? await buildInviteQrSvg(inviteUrl) : null

  const manualForm = <GuestInviteForm defaultSubGroup={me.sub_group} meetings={meetings} />

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader
        title="Invite a Guest to RED"
        subtitle="Show your code, or add their details yourself."
        backHref="/"
      />

      {inviteUrl ? (
        <InviteGuestTabs
          qrPanel={<InviteQrPanel qrSvg={qrSvg} inviteUrl={inviteUrl} memberName={memberName(me)} />}
          manualForm={manualForm}
        />
      ) : (
        <>
          <p className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
            Personal QR codes aren&apos;t switched on yet. You can still invite a guest by entering their details
            below.
          </p>
          {manualForm}
        </>
      )}
    </AppShell>
  )
}
