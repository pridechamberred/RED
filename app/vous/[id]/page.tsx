import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { Button } from "@/components/ui/button"
import { VousDecision } from "@/components/vous/vous-decision"
import { CancelVousButton } from "@/components/vous/cancel-vous-button"
import { AddToCalendar } from "@/components/vous/add-to-calendar"
import { getCurrentMember } from "@/lib/data"
import { getVousRequest } from "@/lib/vous-data"
import { nyWallToUtc } from "@/lib/calendar"
import { isAdmin } from "@/lib/types"
import {
  confirmedLocationLabel,
  formatTimeRange,
  formatVousDate,
  formatWindow,
  partyName,
  vousLocationLabel,
  VOUS_LOCATION_EMOJI,
  type CalendarEvent,
} from "@/lib/vous"
import { CalendarClock, PartyPopper, XCircle } from "lucide-react"

export default async function VousPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const me = await getCurrentMember()
  // Deep links from email land here; carry the path so login returns them.
  if (!me) redirect(`/auth/login?next=/vous/${id}`)

  const req = await getVousRequest(id)
  if (!req) {
    return (
      <AppShell showAdmin={isAdmin(me.role)}>
        <FormHeader
          title="Vous not found"
          subtitle="This request may have been removed, or it isn't one of yours."
          backHref="/"
          backLabel="Home"
        />
      </AppShell>
    )
  }

  const viewerIsInviter = req.inviter.id === me.id
  const other = viewerIsInviter ? req.invitee : req.inviter
  const isMyTurn = req.proposedBy !== me.id

  // ---- Confirmed: the celebration screen ----
  if (req.status === "confirmed" && req.confirmed) {
    const c = req.confirmed
    const dateLabel = formatVousDate(c.date)
    const timeLabel = formatTimeRange(c.start, c.end)
    const locationLabel = confirmedLocationLabel(
      c.location,
      req.inviter.firstName,
      req.invitee.firstName,
      c.locationOther,
    )
    const startUtc = nyWallToUtc(c.date, c.start)
    const endUtc = nyWallToUtc(c.date, c.end)
    const event: CalendarEvent | null =
      startUtc && endUtc
        ? {
            title: `Vous: ${partyName(req.inviter)} + ${partyName(req.invitee)}`,
            details: "RED Group Vous arranged through incREDible.",
            location: locationLabel,
            startUtcISO: startUtc.toISOString(),
            endUtcISO: endUtc.toISOString(),
          }
        : null

    return (
      <AppShell showAdmin={isAdmin(me.role)}>
        <FormHeader title="Your Vous" backHref="/" backLabel="Home" />

        <div className="mt-4 flex flex-col items-center gap-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary">
            <PartyPopper className="size-8 text-primary-foreground" aria-hidden />
          </span>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance" role="status">
              {"You're Vous-ing! 🎉"}
            </h1>
            <p className="text-base font-semibold text-pretty">
              {`${partyName(req.inviter)} + ${partyName(req.invitee)}`}
            </p>
          </div>

          <dl className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card text-left">
            <div className="flex items-start justify-between gap-4 px-4 py-3.5">
              <dt className="text-sm text-muted-foreground">When</dt>
              <dd className="text-right text-sm font-semibold">{dateLabel}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border px-4 py-3.5">
              <dt className="text-sm text-muted-foreground">Time</dt>
              <dd className="text-right text-sm font-semibold">{timeLabel}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border px-4 py-3.5">
              <dt className="text-sm text-muted-foreground">Where</dt>
              <dd className="text-right text-sm font-semibold">{locationLabel}</dd>
            </div>
          </dl>

          {event ? <AddToCalendar event={event} uid={`vous-${req.id}@incredible`} /> : null}

          <Button render={<Link href="/" />} nativeButton={false} variant="ghost" size="lg" className="h-12 w-full max-w-xs text-base">
            Done
          </Button>

          <CancelVousButton id={req.id} label="Cancel this Vous" />
        </div>
      </AppShell>
    )
  }

  // ---- Cancelled / expired ----
  if (req.status === "cancelled" || req.status === "expired") {
    const cancelled = req.status === "cancelled"
    return (
      <AppShell showAdmin={isAdmin(me.role)}>
        <FormHeader title="Vous" backHref="/" backLabel="Home" />
        <div className="mt-4 flex flex-col items-center gap-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-muted">
            <XCircle className="size-8 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance" role="status">
              {cancelled ? "This Vous was cancelled" : "This Vous expired"}
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
              {`No problem — you can always set up a new one with ${other.firstName}.`}
            </p>
          </div>
          <Button
            render={<Link href={`/vous/new?member=${other.id}`} />}
            nativeButton={false}
            size="lg"
            className="h-12 w-full max-w-xs text-base"
          >
            {`Request a new Vous`}
          </Button>
          <Button render={<Link href="/" />} nativeButton={false} variant="ghost" size="lg" className="h-12 w-full max-w-xs text-base">
            Back to Home
          </Button>
        </div>
      </AppShell>
    )
  }

  // ---- Pending / counter-proposed ----
  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <FormHeader
        title={`Vous with ${partyName(other)}`}
        subtitle={isMyTurn ? "Pick a time and place, or suggest your own." : undefined}
        backHref="/"
        backLabel="Home"
      />

      {req.message ? (
        <div className="mt-5 rounded-2xl border border-border bg-card px-4 py-3.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {`${req.inviter.firstName}'s note`}
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{req.message}</p>
        </div>
      ) : null}

      <div className="mt-6">
        {isMyTurn ? (
          <VousDecision request={req} viewerIsInviter={viewerIsInviter} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
              >
                <CalendarClock className="size-5" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {`Waiting for ${other.firstName} to pick one of your times.`}
              </p>
            </div>

            <section className="flex flex-col gap-2.5">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Times you proposed</h2>
              <ul className="flex flex-col gap-2">
                {req.windows.map((w, i) => (
                  <li key={i} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <span className="text-sm font-medium">{formatWindow(w)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Places you suggested</h2>
              <div className="flex flex-wrap gap-2">
                {req.locations.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground"
                  >
                    <span aria-hidden>{VOUS_LOCATION_EMOJI[key]}</span>
                    {key === "other" && req.locationOther ? req.locationOther : vousLocationLabel(key, viewerIsInviter)}
                  </span>
                ))}
              </div>
            </section>

            <CancelVousButton id={req.id} label="Cancel this request" />
          </div>
        )}
      </div>

      {isMyTurn ? (
        <div className="mt-8">
          <CancelVousButton id={req.id} label="Cancel this request" />
        </div>
      ) : null}
    </AppShell>
  )
}
