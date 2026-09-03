"use client"

import { useState } from "react"
import { recordVous } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"
import { todayISO } from "@/lib/types"

export function VousForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return <RecordSuccess title="Vous recorded!" againHref="/" againLabel="Record another activity" />
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    form.set("memberId", memberId)

    const result = await recordVous(form)
    if (result.ok) {
      setDone(true)
    } else {
      setError(result.error)
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
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="Anything you'd like to remember about this meeting?"
          className="resize-none text-base"
        />
      </div>

      <FormError message={error} />

      <SubmitButton pending={pending}>Record Vous</SubmitButton>

      <p className="text-center text-xs text-muted-foreground">{`Recording a 1:1 with ${memberName}`}</p>
    </form>
  )
}
