"use client"

import { useState, useTransition } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addManualPrideChamberEvent, removeManualPrideChamberEvent } from "@/app/admin/pride-chamber/actions"
import { formatLongDate } from "@/lib/eastern-date"
import type { ManualPrideChamberEvent } from "@/lib/pride-chamber-sync"

export function ManualPrideChamberEvents({
  events,
  today,
}: {
  events: ManualPrideChamberEvent[]
  today: string
}) {
  const [title, setTitle] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(null)
    startTransition(async () => {
      const res = await addManualPrideChamberEvent({ title, eventDate })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaved(
        eventDate > today
          ? `Added. Members can record it from ${formatLongDate(eventDate)}.`
          : "Added. Members can record it now.",
      )
      setTitle("")
      setEventDate("")
    })
  }

  function onRemove(id: string) {
    setError(null)
    setSaved(null)
    setRemovingId(id)
    startTransition(async () => {
      const res = await removeManualPrideChamberEvent(id)
      if (!res.ok) setError(res.error)
      setRemovingId(null)
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Add an event manually</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use this when the sync can&apos;t reach the calendar. Past and future dates are fine. Members only see an event
          in the attendance list from the day it takes place.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="manual-event-title">Event name</Label>
          <Input
            id="manual-event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            placeholder="e.g. Pride Chamber Business After Hours"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor="manual-event-date">Date</Label>
          <Input
            id="manual-event-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="h-9">
          <Plus className="size-4" aria-hidden />
          {pending && !removingId ? "Adding…" : "Add event"}
        </Button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : saved ? (
        <p role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {saved}
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const upcoming = event.eventDate > today
            return (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatLongDate(event.eventDate)}
                    {upcoming ? " · Hidden from members until this date" : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {upcoming ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Upcoming
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={pending}
                    onClick={() => onRemove(event.id)}
                    aria-label={`Remove ${event.title}`}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
