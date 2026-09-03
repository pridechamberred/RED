"use client"

import { useMemo, useState } from "react"
import { recordDoneDeal } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DealNoteField } from "@/components/forms/deal-note-field"
import {
  ReferralSourceField,
  buildReferralSourceOptions,
  type ReferralSourceOption,
} from "@/components/forms/referral-source-field"
import { FormError } from "@/components/form-error"
import { SubmitButton } from "@/components/submit-button"
import { type MemberOption, todayISO } from "@/lib/types"
import { cn } from "@/lib/utils"

const FREQUENCIES = [
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
  { value: "quarter", label: "per quarter" },
  { value: "year", label: "per year" },
] as const

/**
 * Adds one deal to the record. Unlike the other activity forms this never
 * navigates away: on success it resets itself and tells the page to refresh, so
 * the table below updates in place.
 */
export function DoneDealForm({
  members,
  onAdded,
}: {
  /** Everyone the deal could have been referred by — excludes the caller. */
  members: MemberOption[]
  onAdded: (warning?: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dealType, setDealType] = useState<"one-off" | "recurring">("one-off")
  const [frequency, setFrequency] = useState<string>("month")
  // The referral source is held in state rather than read off the form, because
  // the answer is an object (a category plus an optional member id) and the
  // combobox is controlled.
  const [referralSource, setReferralSource] = useState<ReferralSourceOption | null>(null)
  // Bumping this remounts the inputs, which clears them without us having to
  // track each field's value.
  const [formKey, setFormKey] = useState(0)

  const referralOptions = useMemo(() => buildReferralSourceOptions(members), [members])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Checked here as well as on the server: the combobox's own `required` only
    // catches an empty text box, and a member could type a partial name that
    // matches nothing and never pick an option, leaving text on screen but no
    // selection behind it.
    if (referralSource === null) {
      setError("Please choose who this deal followed a referral from.")
      return
    }

    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    form.set("dealType", dealType)
    if (dealType === "recurring") form.set("recurringFrequency", frequency)

    const res = await recordDoneDeal(form)
    if (res.ok) {
      setFormKey((k) => k + 1)
      setDealType("one-off")
      setFrequency("month")
      // Controlled state, so the remount above does not clear this one.
      setReferralSource(null)
      setPending(false)
      // `note` is set only when the deal saved but its private note did not.
      onAdded(res.note)
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium leading-none">Deal type</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "one-off", label: "One-off" },
              { value: "recurring", label: "Recurring" },
            ] as const
          ).map((option) => {
            const selected = dealType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDealType(option.value)}
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
      </fieldset>

      {dealType === "one-off" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="dealValue">Deal value</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="dealValue"
              name="dealValue"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className="h-12 pl-8"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="recurringValue">Recurring amount</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="recurringValue"
                name="recurringValue"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className="h-12 pl-8"
              />
            </div>
            <Select value={frequency} onValueChange={(v) => setFrequency(v ?? frequency)}>
              <SelectTrigger className="h-12 w-[9.5rem]" aria-label="Recurring frequency">
                <SelectValue>
                  {(v: string | null) => FREQUENCIES.find((f) => f.value === v)?.label ?? "Select"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The total builds up from the date below, so there&apos;s no need to estimate the year ahead.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="date">{dealType === "recurring" ? "First payment date" : "Date closed"}</Label>
        <Input id="date" name="date" type="date" required defaultValue={todayISO()} max={todayISO()} className="h-12" />
      </div>

      <ReferralSourceField options={referralOptions} value={referralSource} onChange={setReferralSource} />

      <DealNoteField />

      <FormError message={error} />

      <SubmitButton pending={pending}>Add to record</SubmitButton>
    </form>
  )
}
