"use client"

import { useState } from "react"
import { recordVolunteering } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"
import { todayISO } from "@/lib/types"

export function VolunteeringForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <RecordSuccess
        title="Volunteering recorded!"
        againHref="/record/volunteering"
        againLabel="Record more hours"
      />
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const res = await recordVolunteering(new FormData(e.currentTarget))
    if (res.ok) {
      setDone(true)
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required defaultValue={todayISO()} max={todayISO()} className="h-12" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization">Organization / event</Label>
        <Input
          id="organization"
          name="organization"
          required
          autoComplete="off"
          placeholder="Community Food Drive"
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hours">Hours</Label>
        <Input
          id="hours"
          name="hours"
          type="number"
          inputMode="decimal"
          min="0.25"
          max="24"
          step="0.25"
          required
          placeholder="3"
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={3} className="resize-none text-base" />
      </div>

      <FormError message={error} />

      <SubmitButton pending={pending}>Record Hours</SubmitButton>
    </form>
  )
}
