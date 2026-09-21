"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { requestVous } from "@/app/vous/actions"
import { AvailabilityEditor, emptyWindow, type DraftWindow } from "@/components/vous/availability-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/form-error"
import { SubmitButton } from "@/components/submit-button"
import { timeToMinutes, VOUS_LOCATION_OPTIONS, type VousLocationKey } from "@/lib/vous"

function isComplete(w: DraftWindow): boolean {
  const s = timeToMinutes(w.start)
  const e = timeToMinutes(w.end)
  return Boolean(w.date) && s !== null && e !== null && s < e
}

export function RequestVousForm({ inviteeId, inviteeName }: { inviteeId: string; inviteeName: string }) {
  const router = useRouter()
  const [windows, setWindows] = useState<DraftWindow[]>([emptyWindow()])
  const [locations, setLocations] = useState<Set<VousLocationKey>>(new Set())
  const [locationOther, setLocationOther] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  function toggleLocation(key: VousLocationKey) {
    setLocations((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setExistingId(null)

    const complete = windows.filter(isComplete)
    if (complete.length === 0) {
      setError("Please add at least one time window with a date, start and end.")
      return
    }
    if (locations.size === 0) {
      setError("Please choose at least one place you'd like to meet.")
      return
    }

    setPending(true)
    const form = new FormData()
    form.set("inviteeId", inviteeId)
    form.set("windows", JSON.stringify(complete))
    form.set("locations", JSON.stringify([...locations]))
    if (locations.has("other")) form.set("locationOther", locationOther)
    if (message.trim()) form.set("message", message.trim())

    const result = await requestVous(form)
    if (result.ok) {
      router.push(`/vous/${result.id}`)
      return
    }
    setError(result.error)
    if (result.existingId) setExistingId(result.existingId)
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">When works for you?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {`Offer a few windows and ${inviteeName.split(" ")[0]} picks one.`}
          </p>
        </div>
        <AvailabilityEditor windows={windows} onChange={setWindows} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Where would you meet?</h2>
        <div className="flex flex-wrap gap-2">
          {VOUS_LOCATION_OPTIONS.map((option) => {
            const active = locations.has(option.key)
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLocation(option.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span aria-hidden>{option.emoji}</span>
                {option.label}
              </button>
            )
          })}
        </div>
        {locations.has("other") ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="locationOther">Where else?</Label>
            <Input
              id="locationOther"
              value={locationOther}
              onChange={(e) => setLocationOther(e.target.value)}
              placeholder="e.g. The park, a co-working space…"
              className="h-12"
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="message">
          Add a note <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="I'd love to catch up about your business."
          className="resize-none text-base"
        />
      </section>

      <FormError message={error} />

      {existingId ? (
        <Button
          render={<Link href={`/vous/${existingId}`} />}
          nativeButton={false}
          variant="outline"
          className="h-11"
        >
          View your existing Vous
        </Button>
      ) : null}

      <SubmitButton pending={pending}>Send Vous request</SubmitButton>

      <p className="text-center text-xs text-muted-foreground">{`Requesting a 1:1 with ${inviteeName}`}</p>
    </form>
  )
}
