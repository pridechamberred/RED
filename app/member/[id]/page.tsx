import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { initials, isAdmin, memberName } from "@/lib/types"
import { ChevronRight, Handshake, Gift } from "lucide-react"

const ACTIONS = [
  {
    slug: "vous",
    Icon: Handshake,
    title: "Record a Vous",
    description: "A 1:1 meeting with this person",
  },
  {
    slug: "referral",
    Icon: Gift,
    title: "Pass a Referral",
    description: "Send them someone worth knowing",
  },
] as const

export default async function MemberActionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  if (id === me.id) redirect("/")

  const member = await getMemberById(id)
  if (!member) notFound()

  const name = memberName(member)

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader title={name} subtitle="What would you like to record?" backHref="/" backLabel="Search" />

      <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground"
        >
          {initials(member)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold leading-tight">{name}</span>
          <span className="truncate text-sm leading-relaxed text-muted-foreground">
            {member.company ? `${member.company} · ${member.sub_group}` : member.sub_group}
          </span>
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {ACTIONS.map((action) => (
          <li key={action.slug}>
            <Link
              href={`/record/${action.slug}?member=${member.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition-colors hover:border-primary/40 hover:bg-accent/60"
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <action.Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-lg font-semibold leading-tight">{action.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{action.description}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  )
}
