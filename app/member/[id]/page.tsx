import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { MemberAvatar } from "@/components/member-avatar"
import { MemberSocials } from "@/components/member-socials"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { formatSubGroups, isAdmin, memberName } from "@/lib/types"
import { CalendarPlus, ChevronRight, Handshake, Gift, Mail, Phone } from "lucide-react"

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
      <FormHeader title={name} subtitle="What would you like to do?" backHref="/" backLabel="Search" />

      <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
        <MemberAvatar member={member} size="md" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold leading-tight">{name}</span>
          <span className="truncate text-sm leading-relaxed text-muted-foreground">
            {member.company ? `${member.company} · ${formatSubGroups(member)}` : formatSubGroups(member)}
          </span>
          {member.share_contact === true ? (
            <span className="mt-1.5 flex flex-col gap-1 text-sm">
              {member.phone ? (
                <a
                  href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{member.phone}</span>
                </a>
              ) : null}
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{member.email}</span>
              </a>
            </span>
          ) : null}
        </span>
      </div>

      <Link
        href={`/vous/new?member=${member.id}`}
        className="mt-4 flex items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-5 transition-colors hover:border-primary/70 hover:bg-primary/10"
      >
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <CalendarPlus className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-semibold leading-tight">🤝 Request a Vous</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            {`Find a time to meet ${member.first_name}`}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <ul className="mt-3 flex flex-col gap-3">
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

      <MemberSocials member={member} firstName={member.first_name} />
    </AppShell>
  )
}
