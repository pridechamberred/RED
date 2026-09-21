import Link from "next/link"
import { getVousSummary } from "@/lib/vous-data"
import { formatTime, formatVousDateShort, partyName, type VousRequestRecord } from "@/lib/vous"
import { CalendarCheck, ChevronRight, Handshake } from "lucide-react"

function otherParty(r: VousRequestRecord, meId: string) {
  return r.inviter.id === meId ? r.invitee : r.inviter
}

/**
 * The home-screen Vous panel. Shows only what needs the member: requests
 * waiting on them, and confirmed vous still to come. Renders nothing when there
 * is neither, so it never clutters the dashboard of someone not using it.
 */
export async function VousDashboard({ memberId }: { memberId: string }) {
  const { actionable, upcoming } = await getVousSummary(memberId)
  if (actionable.length === 0 && upcoming.length === 0) return null

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Your Vous</h2>

      <ul className="flex flex-col gap-3">
        {actionable.map((r) => {
          const other = otherParty(r, memberId)
          const headline =
            r.status === "counter_proposed"
              ? `${other.firstName} suggested new times`
              : `${other.firstName} wants to Vous with you`
          return (
            <li key={r.id}>
              <Link
                href={`/vous/${r.id}`}
                className="flex items-center gap-3.5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 transition-colors hover:border-primary/60"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                >
                  <Handshake className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold leading-tight text-balance">{headline}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">Tap to respond</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Respond
                </span>
              </Link>
            </li>
          )
        })}

        {upcoming.map((r) => {
          const other = otherParty(r, memberId)
          const c = r.confirmed!
          return (
            <li key={r.id}>
              <Link
                href={`/vous/${r.id}`}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                >
                  <CalendarCheck className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold leading-tight">{`${formatVousDateShort(c.date)} · ${formatTime(c.start)}`}</span>
                  <span className="truncate text-sm leading-relaxed text-muted-foreground">
                    {`Vous with ${partyName(other)}`}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
