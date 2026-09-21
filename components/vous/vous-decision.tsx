"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { confirmVous, counterProposeVous } from "@/app/vous/actions"
import { AvailabilityEditor, emptyWindow, type DraftWindow } from "@/components/vous/availability-editor"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FormError } from "@/components/form-error"
import { SubmitButton } from "@/components/submit-button"
import {
  formatTime,
  formatTimeRange,
  formatVousDate,
  minutesToTime,
  timeToMinutes,
  vousLocationLabel,
  VOUS_LOCATION_EMOJI,
  type VousLocationKey,
  type VousRequestRecord,
} from "@/lib/vous"

const DURATIONS = [30, 45, 60, 90]

function startOptions(start: string, end: string): string[] {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === null || e === null) return []
  const out: string[] = []
  for (let t = s; t < e; t += 15) out.push(minutesToTime(t))
  return out
}

function durationOptions(startTime: string, end: string): number[] {
  const s = timeToMinutes(startTime)
  const e = timeToMinutes(end)
  if (s === null || e === null) return [60]
  const fits = DURATIONS.filter((d) => s + d <= e)
  return fits.length > 0 ? fits : [e - s]
}

function bestDuration(startTime: string, end: string): number {
  const options = durationOptions(startTime, end)
  return options.includes(60) ? 60 : options[options.length - 1]
}

function isComplete(w: DraftWindow): boolean {
  const s = timeToMinutes(w.start)
  const e = timeToMinutes(w.end)
  return Boolean(w.date) && s !== null && e !== null && s < e
}

export function VousDecision({
  request,
  viewerIsInviter,
}: {
  request: VousRequestRecord
  viewerIsInviter: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<"choose" | "counter">("choose")

  // Choose-a-time state.
  const [index, setIndex] = useState<number | null>(request.windows.length === 1 ? 0 : null)
  const initialWindow = request.windows[0]
  const [start, setStart] = useState<string>(initialWindow ? initialWindow.start : "09:00")
  const [duration, setDuration] = useState<number>(
    initialWindow ? bestDuration(initialWindow.start, initialWindow.end) : 60,
  )
  const [location, setLocation] = useState<VousLocationKey | null>(
    request.locations.length === 1 ? request.locations[0] : null,
  )

  // Counter-proposal state.
  const [counterWindows, setCounterWindows] = useState<DraftWindow[]>([emptyWindow()])

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectWindow(i: number) {
    setIndex(i)
    const win = request.windows[i]
    setStart(win.start)
    setDuration(bestDuration(win.start, win.end))
  }

  function changeStart(next: string) {
    setStart(next)
    const win = index !== null ? request.windows[index] : null
    if (win) setDuration(bestDuration(next, win.end))
  }

  const selectedWindow = index !== null ? request.windows[index] : null
  const endPreview = (() => {
    if (!selectedWindow) return null
    const s = timeToMinutes(start)
    const e = timeToMinutes(selectedWindow.end)
    if (s === null || e === null) return null
    return minutesToTime(Math.min(s + duration, e))
  })()

  async function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (index === null) {
      setError("Please choose one of the proposed times.")
      return
    }
    if (!location) {
      setError("Please choose where you'll meet.")
      return
    }
    setPending(true)
    const form = new FormData()
    form.set("id", request.id)
    form.set("windowIndex", String(index))
    form.set("start", start)
    form.set("duration", String(duration))
    form.set("location", location)
    const result = await confirmVous(form)
    if (result.ok) {
      router.refresh()
      return
    }
    setError(result.error)
    setPending(false)
  }

  async function onCounter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const complete = counterWindows.filter(isComplete)
    if (complete.length === 0) {
      setError("Please add at least one time that works for you.")
      return
    }
    setPending(true)
    const form = new FormData()
    form.set("id", request.id)
    form.set("windows", JSON.stringify(complete))
    const result = await counterProposeVous(form)
    if (result.ok) {
      router.refresh()
      return
    }
    setError(result.error)
    setPending(false)
  }

  if (mode === "counter") {
    return (
      <form onSubmit={onCounter} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Suggest your times</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Offer a few windows that suit you and we&apos;ll send them straight back.
          </p>
        </div>
        <AvailabilityEditor windows={counterWindows} onChange={setCounterWindows} />
        <FormError message={error} />
        <SubmitButton pending={pending}>Suggest another time</SubmitButton>
        <button
          type="button"
          onClick={() => {
            setMode("choose")
            setError(null)
          }}
          className="text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to their times
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={onConfirm} className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Pick a time</h2>
        <ul className="flex flex-col gap-2.5">
          {request.windows.map((w, i) => {
            const selected = index === i
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectWindow(i)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="font-semibold leading-tight">{formatVousDate(w.date)}</span>
                  <span className="text-sm text-muted-foreground">{formatTimeRange(w.start, w.end)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {selectedWindow ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Exact time</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vous-start-time">Start</Label>
              <select
                id="vous-start-time"
                value={start}
                onChange={(e) => changeStart(e.target.value)}
                className="h-12 rounded-lg border border-border bg-card px-3 text-base"
              >
                {startOptions(selectedWindow.start, selectedWindow.end).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vous-duration">Length</Label>
              <select
                id="vous-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-12 rounded-lg border border-border bg-card px-3 text-base"
              >
                {durationOptions(start, selectedWindow.end).map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          {endPreview ? (
            <p className="text-sm text-muted-foreground">
              {`You'll meet ${formatTime(start)} – ${formatTime(endPreview)}.`}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Where</h2>
        <div className="flex flex-wrap gap-2">
          {request.locations.map((key) => {
            const active = location === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setLocation(key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span aria-hidden>{VOUS_LOCATION_EMOJI[key]}</span>
                {key === "other" && request.locationOther
                  ? request.locationOther
                  : vousLocationLabel(key, viewerIsInviter)}
              </button>
            )
          })}
        </div>
      </section>

      <FormError message={error} />

      <div className="flex flex-col gap-2.5">
        <SubmitButton pending={pending}>Confirm Vous</SubmitButton>
        <button
          type="button"
          onClick={() => {
            setMode("counter")
            setError(null)
          }}
          className="h-11 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          None of these work
        </button>
      </div>
    </form>
  )
}
