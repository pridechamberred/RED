import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { ReferralForm } from "@/components/forms/referral-form"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { isAdmin, memberName } from "@/lib/types"

export default async function RecordReferralPage({
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
        title={`Pass a referral to ${name}`}
        subtitle="Tell them who to contact and why."
        backHref={`/member/${member.id}`}
        backLabel={name}
      />
      <ReferralForm memberId={member.id} memberFirstName={member.first_name} />
    </AppShell>
  )
}
