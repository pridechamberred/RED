"use client"

import { useState } from "react"
import { recordReferral } from "@/app/actions"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"

/**
 * 'new'     — the referral is being made here and now. The recipient is emailed
 *             the full details, as this form has always done.
 * 'offline' — the referral already happened elsewhere (at an event, by phone).
 *             Both people have already spoken and the recipient has the
 *             details, so the only fact worth capturing is who was referred,
 *             and when. Every other field is deliberately hidden rather than
 *             shown-but-optional: an empty box invites the member to re-type
 *             something the recipient already knows.
 */
type ReferralMode = "new" | "offline"

const MODES = [
  { value: "offline", label: "Already passed" },
  { value: "new", label: "New referral" },
] as const

export function ReferralForm({
  memberId,
  memberFirstName,
}: {
  memberId: string
  memberFirstName: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ done: boolean; note?: string; mode?: ReferralMode }>({ done: false })

  const [mode, setMode] = useState<ReferralMode>("new")
  // Tracked so the notify question can appear only once an email exists to send
  // to — asking "shall we email them?" above an empty email box is nonsense.
  const [email, setEmail] = useState("")
  // Defaults to "no". Emailing someone outside the chamber is a side effect on
  // a third party, so it happens only when the member actively opts in, never
  // because a default was left untouched.
  const [notify, setNotify] = useState(false)

  const hasEmail = email.trim().length > 0

  if (result.done) {
    // No "make another referral" action here: a referral has to start from a
    // chosen member, so there is no route back into this form on its own. The
    // old button pointed at a page that couldn't render, so Back to Home is the
    // only real way onward.
    return (
      <RecordSuccess
        title={result.mode === "offline" ? "Referral recorded!" : "Referral sent!"}
        note={result.note}
      />
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    form.set("memberId", memberId)
    form.set("referralMode", mode)
    // Only meaningful for a new referral that carries an email; the action
    // ignores it otherwise, but sending the truth keeps the two in step.
    form.set("notifyReferred", mode === "new" && hasEmail && notify ? "yes" : "no")

    const res = await recordReferral(form)
    if (res.ok) {
      setResult({ done: true, note: res.note, mode })
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="referredName">Referred person&apos;s name</Label>
        <Input id="referredName" name="referredName" required autoComplete="off" className="h-12" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium leading-none">Type of referral</legend>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((option) => {
            const selected = mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {mode === "offline"
            ? `You already passed this referral to ${memberFirstName} in person or by phone. Just logging it for the record.`
            : `${memberFirstName} will get the details by email.`}
        </p>
      </fieldset>

      {mode === "offline" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="occurredOn">
            When did you pass it on? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="occurredOn" name="occurredOn" type="date" className="h-12" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Leave blank for today. Set it to the day of the event so it counts in the right week.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="referredEmail">
              Referred person&apos;s email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="referredEmail"
              name="referredEmail"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {hasEmail ? (
            <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <legend className="px-1 text-sm font-medium leading-snug">
                Shall we email them about your referral?
              </legend>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: true, label: "Yes please" },
                    { value: false, label: "No, I'll let them know myself" },
                  ] as const
                ).map((option) => {
                  const selected = notify === option.value
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => setNotify(option.value)}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-12 items-center rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="referredPhone">
              Referred person&apos;s phone <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="referredPhone"
              name="referredPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="h-12"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="referredCompany">
              Referred person&apos;s company <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="referredCompany" name="referredCompany" autoComplete="off" className="h-12" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="details">Referral details</Label>
            <Textarea
              id="details"
              name="details"
              rows={5}
              required
              placeholder={`Tell ${memberFirstName} about the person you're referring and why you think they should connect.`}
              className="resize-none text-base"
            />
          </div>
        </>
      )}

      <FormError message={error} />

      <SubmitButton pending={pending}>
        {mode === "offline" ? "Record Referral" : "Send Referral"}
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "offline"
          ? `${memberFirstName} gets a short note that you logged it.`
          : `${memberFirstName} gets an email with these details straight away.`}
      </p>
    </form>
  )
}
