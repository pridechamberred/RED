"use client"

import { useState } from "react"
import { recordChamberEvent } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"
import { todayISO, type PrideChamberEventOption } from "@/lib/types"

/**
 * Records attendance at a Pride Chamber event.
 *
 * The event name is authoritative: members pick from the imported calendar
 * events rather than typing, and only the event's database id is submitted (the
 * server resolves the name and date from it). A "can't find your event?"
 * fallback reveals a free-text field for anything not in the list — and it is
 * the only view offered when there are no imported events to choose from.
 */
export function ChamberEventForm({ events }: { events: PrideChamberEventOption[] }) {
  const hasEvents = events.length > 0

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Manual entry starts open only when there is nothing to pick from.
  const [manual, setManual] = useState(!hasEvents)

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
    setError(null)

    if (!manual && !selectedId) {
      setError("Please choose the event you attended.")
      return
    }

    setPending(true)
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
      {!manual ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="prideChamberEvent">Which Pride Chamber event did you attend?</Label>
          <Select value={selectedId} onValueChange={(value) => setSelectedId(value as string | null)}>
            <SelectTrigger id="prideChamberEvent" className="h-12 w-full">
              {/* Base UI renders the raw value (the event id) unless given a
                  function child, so map the selected id back to its label. */}
              <SelectValue placeholder="Select an event">
                {(value) => events.find((event) => event.id === value)?.label ?? "Select an event"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* The server reads only this id and re-derives the name and date. */}
          <input type="hidden" name="prideChamberEventId" value={selectedId ?? ""} />
          <button
            type="button"
            onClick={() => {
              setManual(true)
              setSelectedId(null)
              setError(null)
            }}
            className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Can&apos;t find your event?
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {!hasEvents ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              No recent Pride Chamber events are currently available. Please try again later or contact an
              administrator. You can still record an event below.
            </p>
          ) : null}

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
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={todayISO()}
              max={todayISO()}
              className="h-12"
            />
          </div>

          {hasEvents ? (
            <button
              type="button"
              onClick={() => {
                setManual(false)
                setError(null)
              }}
              className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Choose from the event list instead
            </button>
          ) : null}
        </div>
      )}

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
