"use client"

import { Fragment, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Gift, Lock, Pencil, Plus, X } from "lucide-react"
import { updateDoneDeal } from "@/app/actions"
import { DoneDealForm } from "@/components/forms/done-deal-form"
import { DealNoteField } from "@/components/forms/deal-note-field"
import {
  ReferralSourceField,
  buildReferralSourceOptions,
  type ReferralSourceOption,
} from "@/components/forms/referral-source-field"
import { FormError } from "@/components/form-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { describeDealType, FREQUENCY_PER, type DealWithTotal } from "@/lib/deal-totals"
import { formatDate, formatMoney, referralSourceLabel, type MemberOption, todayISO } from "@/lib/types"

/** The headline figure for a deal: the one-off amount, or the per-period rate. */
function dealRate(deal: DealWithTotal) {
  if (deal.dealType === "one-off") return formatMoney(Number(deal.dealValue ?? 0))
  return formatMoney(Number(deal.recurringValue ?? 0))
}

function rateSuffix(deal: DealWithTotal) {
  if (deal.dealType === "one-off" || !deal.recurringFrequency) return null
  return FREQUENCY_PER[deal.recurringFrequency]
}

/** Explains where a total came from — accrual, an override, or a stopped deal. */
function TotalNote({ deal }: { deal: DealWithTotal }) {
  // A stopped recurring deal stays stopped even when its total is overridden, so
  // the two notes have to be able to show together — otherwise overriding a
  // stopped deal silently hides the fact that it is no longer running.
  const stoppedNote =
    deal.dealType !== "one-off" && deal.stopped && deal.recurringEndedOn
      ? `Stopped ${formatDate(deal.recurringEndedOn)}`
      : null

  if (deal.overridden) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline" className="text-xs font-medium">
          Manual total
        </Badge>
        {stoppedNote ? <span className="text-xs text-muted-foreground">{stoppedNote}</span> : null}
      </div>
    )
  }
  if (deal.dealType === "one-off") return null

  const payments = `${deal.periods} ${deal.periods === 1 ? "payment" : "payments"}`
  if (stoppedNote) {
    return (
      <span className="text-xs text-muted-foreground">
        {payments} · stopped {formatDate(deal.recurringEndedOn!)}
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{payments} so far</span>
}

/**
 * A saved private note, shown on the record so it is actually useful as a
 * reminder. Only ever rendered here, on the member's own page — notes are not
 * fetched for the admin views at all.
 */
function DealNote({ note }: { note: string }) {
  return (
    <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
      <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0 break-words">
        <span className="sr-only">Private note: </span>
        {note}
      </span>
    </p>
  )
}

/**
 * Where a deal's referral came from.
 *
 * Unlike the private note above, this is not confidential — admins see it too.
 * It is muted rather than hidden for deals predating the field, so an
 * unanswered deal is visibly unanswered and can be filled in via Update.
 */
function DealReferralSource({ deal }: { deal: DealWithTotal }) {
  const label = referralSourceLabel(deal.referralSource, deal.referralFromMemberName)
  const unrecorded = deal.referralSource === null

  return (
    <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
      <Gift aria-hidden className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0 break-words">
        <span className="sr-only">Referral from: </span>
        <span className={unrecorded ? "italic" : undefined}>{label}</span>
      </span>
    </p>
  )
}

/**
 * The amend controls for a single deal: override the total, change the referral
 * source, edit the private note, or stop a recurring deal for good. Rendered
 * inline rather than in a modal so it works the same on a phone as on a
 * desktop.
 */
function UpdatePanel({
  deal,
  year,
  members,
  onClose,
  variant,
}: {
  deal: DealWithTotal
  year: number
  members: MemberOption[]
  onClose: () => void
  // The mobile card list and the desktop table are BOTH in the DOM (each hidden
  // from the other by CSS), so this panel renders twice per deal. Without a
  // per-layout prefix the note field's id and its aria-describedby hint collide,
  // and the label resolves to whichever copy comes first in the DOM — leaving
  // the other textarea with no accessible name. Matches the existing
  // panel-m-/panel-d- convention.
  variant: "m" | "d"
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingStop, setConfirmingStop] = useState(false)

  const referralOptions = useMemo(() => buildReferralSourceOptions(members), [members])
  // Pre-select whatever the deal already says, so the dropdown opens on the
  // current answer rather than blank. Matched on the pair, since `member` is
  // only the same option when it names the same person.
  const [referralSource, setReferralSource] = useState<ReferralSourceOption | null>(
    () =>
      referralOptions.find(
        (o) =>
          o.source === deal.referralSource &&
          (o.source !== "member" || o.label === deal.referralFromMemberName),
      ) ?? null,
  )

  async function submit(intent: string, fields: Record<string, string>) {
    setPending(intent)
    setError(null)

    const form = new FormData()
    form.set("dealId", deal.id)
    form.set("intent", intent)
    for (const [k, v] of Object.entries(fields)) form.set(k, v)

    const res = await updateDoneDeal(form)
    setPending(null)
    if (res.ok) {
      onClose()
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-secondary/40 p-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get("totalOverride")
          submit("override", { totalOverride: typeof value === "string" ? value : "", year: String(year) })
        }}
      >
        <Label htmlFor={`override-${deal.id}`}>Override the {year} total</Label>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id={`override-${deal.id}`}
              name="totalOverride"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              defaultValue={deal.yearTotal}
              className="h-12 bg-card pl-8"
            />
          </div>
          <Button type="submit" disabled={pending !== null} className="h-12">
            {pending === "override" ? "Saving…" : "Save total"}
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Replaces the calculated figure for {year} only.
          {deal.dealType === "recurring" ? " The deal keeps running." : ""}
        </p>
      </form>

      {deal.overridden ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => submit("clear", {})}
          className="h-12 justify-start"
        >
          {pending === "clear" ? "Removing…" : "Remove override and recalculate"}
        </Button>
      ) : null}

      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (referralSource === null) {
            setError("Please choose who this deal followed a referral from.")
            return
          }
          submit("referral", {
            referralSource: referralSource.source,
            referralFromMemberId: referralSource.memberId ?? "",
          })
        }}
      >
        <ReferralSourceField
          id={`referral-${variant}-${deal.id}`}
          options={referralOptions}
          value={referralSource}
          onChange={setReferralSource}
        />
        <Button type="submit" disabled={pending !== null} className="h-12 self-start">
          {pending === "referral" ? "Saving…" : "Save referral source"}
        </Button>
      </form>

      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get("notes")
          submit("notes", { notes: typeof value === "string" ? value : "" })
        }}
      >
        <DealNoteField id={`notes-${variant}-${deal.id}`} defaultValue={deal.note ?? ""} />
        <Button type="submit" disabled={pending !== null} className="h-12 self-start">
          {pending === "notes" ? "Saving…" : deal.note ? "Save note" : "Add note"}
        </Button>
      </form>

      {deal.dealType === "recurring" && !deal.stopped ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {confirmingStop ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const value = new FormData(e.currentTarget).get("endedOn")
                submit("stop", { endedOn: typeof value === "string" ? value : "" })
              }}
            >
              <Label htmlFor={`ended-${deal.id}`}>Last payment date</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id={`ended-${deal.id}`}
                  name="endedOn"
                  type="date"
                  required
                  defaultValue={todayISO()}
                  min={deal.date}
                  max={todayISO()}
                  className="h-12 min-w-40 flex-1 bg-card"
                />
                <Button type="submit" variant="destructive" disabled={pending !== null} className="h-12">
                  {pending === "stop" ? "Stopping…" : "Confirm stop"}
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The total locks at whatever accrued up to this date, and the deal will not resume.
              </p>
            </form>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={pending !== null}
              onClick={() => setConfirmingStop(true)}
              className="h-12 justify-start"
            >
              Stop this recurring deal
            </Button>
          )}
        </div>
      ) : null}

      <FormError message={error} />

      <Button type="button" variant="ghost" onClick={onClose} className="h-10 self-start">
        <X className="size-4" />
        Close
      </Button>
    </div>
  )
}

export function DoneDealsRecord({
  deals,
  year,
  members,
}: {
  deals: DealWithTotal[]
  year: number
  /** Populates the "referral from" dropdown. Excludes the signed-in member. */
  members: MemberOption[]
}) {
  const router = useRouter()
  const [justAdded, setJustAdded] = useState(false)
  // Set only when the deal saved but its private note did not, so the member
  // finds out rather than assuming the note went in.
  const [addWarning, setAddWarning] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const total = deals.reduce((sum, d) => sum + d.yearTotal, 0)

  function onAdded(warning?: string) {
    setJustAdded(true)
    setAddWarning(warning ?? null)
    setExpandedId(null)
    router.refresh()
  }

  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id))

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="add-deal-heading" className="flex flex-col gap-4">
        <h2 id="add-deal-heading" className="text-lg font-bold tracking-tight">
          {justAdded ? "Deal added" : "Add a deal"}
        </h2>

        {justAdded ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2.5 text-sm leading-relaxed">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <Check className="size-4" />
              </span>
              Added to your {year} record below.
            </p>
            {addWarning ? <FormError message={addWarning} /> : null}
            <Button type="button" onClick={() => setJustAdded(false)} className="h-12">
              <Plus className="size-4" />
              Add another
            </Button>
          </div>
        ) : (
          <DoneDealForm members={members} onAdded={onAdded} />
        )}
      </section>

      <section aria-labelledby="record-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="record-heading" className="text-lg font-bold tracking-tight">
            {year} record
          </h2>
          <p className="text-sm text-muted-foreground">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} ·{" "}
            <span className="font-semibold tabular-nums text-foreground">{formatMoney(total)}</span> total
          </p>
        </div>

        {deals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No deals on your {year} record yet. Add your first one above.
          </p>
        ) : (
          <>
            {/* Phone layout: the same four fields, stacked per deal. */}
            <ul className="flex flex-col gap-2.5 sm:hidden">
              {deals.map((deal) => {
                const expanded = expandedId === deal.id
                const suffix = rateSuffix(deal)
                return (
                  <li key={deal.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <time dateTime={deal.date} className="text-xs font-medium tabular-nums text-muted-foreground">
                          {formatDate(deal.date)}
                        </time>
                        <span className="text-sm font-semibold">{describeDealType(deal)}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {dealRate(deal)}
                          {suffix ? ` ${suffix}` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-lg font-bold tabular-nums text-primary">{formatMoney(deal.yearTotal)}</span>
                        <TotalNote deal={deal} />
                      </div>
                    </div>
                    <DealReferralSource deal={deal} />
                    {deal.note ? <DealNote note={deal.note} /> : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggle(deal.id)}
                      aria-expanded={expanded}
                      aria-controls={`panel-m-${deal.id}`}
                      className="h-10 self-start"
                    >
                      <Pencil className="size-3.5" />
                      Update
                    </Button>
                    {expanded ? (
                      <div id={`panel-m-${deal.id}`}>
                        <UpdatePanel
                          deal={deal}
                          year={year}
                          members={members}
                          variant="m"
                          onClose={() => setExpandedId(null)}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {/* Desktop layout: the record as a proper table. */}
            <div className="hidden overflow-hidden rounded-2xl border border-border sm:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Done deals on your {year} record, with the value accrued for each.
                </caption>
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Deal value
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Type / frequency
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Total deal value
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => {
                    const expanded = expandedId === deal.id
                    const suffix = rateSuffix(deal)
                    return (
                      <Fragment key={deal.id}>
                        <tr className="border-b border-border last:border-0">
                          <td className="px-4 py-3.5 align-top">
                            <time dateTime={deal.date} className="tabular-nums">
                              {formatDate(deal.date)}
                            </time>
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums">
                            {dealRate(deal)}
                            {suffix ? <span className="text-muted-foreground"> {suffix}</span> : null}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex flex-col gap-1.5">
                              <span>{describeDealType(deal)}</span>
                              <DealReferralSource deal={deal} />
                              {deal.note ? <DealNote note={deal.note} /> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold tabular-nums text-primary">
                                {formatMoney(deal.yearTotal)}
                              </span>
                              <TotalNote deal={deal} />
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggle(deal.id)}
                              aria-expanded={expanded}
                              aria-controls={`panel-d-${deal.id}`}
                            >
                              <Pencil className="size-3.5" />
                              Update
                            </Button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-border last:border-0">
                            <td colSpan={5} id={`panel-d-${deal.id}`} className="px-4 pb-4">
                              <UpdatePanel
                                deal={deal}
                                year={year}
                                members={members}
                                variant="d"
                                onClose={() => setExpandedId(null)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-secondary/50">
                    <th scope="row" colSpan={3} className="px-4 py-3 text-left font-semibold">
                      Total for {year}
                    </th>
                    <td className="px-4 py-3 text-right text-base font-bold tabular-nums">{formatMoney(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
