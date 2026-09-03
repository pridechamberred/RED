import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { VousForm } from "@/components/forms/vous-form"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { isAdmin, memberName } from "@/lib/types"

export default async function RecordVousPage({
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
        title={`Record a Vous with ${name}`}
        subtitle="Confirm the date and you're done."
        backHref={`/member/${member.id}`}
        backLabel={name}
      />
      <VousForm memberId={member.id} memberName={name} />
    </AppShell>
  )
}
