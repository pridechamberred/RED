import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { RequestVousForm } from "@/components/vous/request-vous-form"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { isAdmin, memberName } from "@/lib/types"

export default async function NewVousPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>
}) {
  const { member: memberId } = await searchParams

  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!memberId || memberId === me.id) redirect("/")

  const member = await getMemberById(memberId)
  if (!member) notFound()

  const name = memberName(member)

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader
        title={`Request a Vous with ${name}`}
        subtitle="Suggest a few times and places — they'll pick one and you're booked."
        backHref={`/member/${member.id}`}
        backLabel={name}
      />
      <RequestVousForm inviteeId={member.id} inviteeName={name} />
    </AppShell>
  )
}
