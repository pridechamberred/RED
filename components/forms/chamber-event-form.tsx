"use client"

import { useState } from "react"
import { recordChamberEvent } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"
import { todayISO } from "@/lib/types"

export function ChamberEventForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <RecordSuccess
        title="Attendance recorded!"
        againHref="/record/chamber-event"
        againLabel="Record another event"
      />
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const res = await recordChamberEvent(new FormData(e.currentTarget))
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
        <Label htmlFor="eventName">Event name</Label>
        <Input
          id="eventName"
          name="eventName"
          required
          autoComplete="off"
          placeholder="e.g. Monthly Business Connect"
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required defaultValue={todayISO()} max={todayISO()} className="h-12" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={3} className="resize-none text-base" />
      </div>

      <FormError message={error} />

      <SubmitButton pending={pending}>Record Attendance</SubmitButton>
    </form>
  )
}
