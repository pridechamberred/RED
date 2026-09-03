import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { UpcomingMeetings } from "@/components/upcoming-meetings"
import { BrandMark } from "@/components/brand-mark"
import { MemberSearch } from "@/components/member-search"
import { getCurrentMember, getSearchableMembers } from "@/lib/data"
import { isAdmin } from "@/lib/types"
import { BadgeDollarSign, CalendarDays, Heart, UserPlus } from "lucide-react"

export default async function HomePage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const members = await getSearchableMembers(me.id)

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <header className="flex flex-col gap-7">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <BrandMark />
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              {me.sub_group}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">RED Group activity tracker</p>
        </div>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
          {`Hey ${me.first_name}, `}
          <span className="text-muted-foreground">what&apos;s up?</span>
        </h1>
      </header>

      <div className="mt-6">
        <MemberSearch members={members} />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">OR LOG DIRECTLY...</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/record/done-deal"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <BadgeDollarSign className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold leading-tight">Done Deals Record</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                Track closed business
              </span>
            </span>
          </Link>

          <Link
            href="/record/volunteering"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <Heart className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">Record Volunteering</span>
              <span className="text-sm leading-relaxed text-muted-foreground">Hours you gave back</span>
            </span>
          </Link>

          <Link
            href="/invite-guest"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <UserPlus className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold leading-tight">Invite a Guest to RED</span>
              <span className="text-sm leading-relaxed text-muted-foreground">Bring someone to a meeting</span>
            </span>
          </Link>

          <Link
            href="/record/chamber-event"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <CalendarDays className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">Record Chamber Event</span>
              <span className="text-sm leading-relaxed text-muted-foreground">Events you attended</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Streamed separately so a slow Google Calendar response cannot hold up
          the rest of the page. */}
      <Suspense fallback={<UpcomingMeetingsSkeleton />}>
        <UpcomingMeetings />
      </Suspense>
    </AppShell>
  )
}

function UpcomingMeetingsSkeleton() {
  return (
    <section className="mt-10 flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">UPCOMING MEETINGS...</h2>
      <div className="flex gap-3 overflow-hidden" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[9.5rem] min-w-[15.5rem] animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <span className="sr-only">Loading upcoming meetings</span>
    </section>
  )
}
