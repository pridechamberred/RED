"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { todayISO } from "@/lib/types"

export type DraftWindow = { date: string; start: string; end: string }

export function emptyWindow(): DraftWindow {
  return { date: "", start: "09:00", end: "10:00" }
}

/**
 * The add/remove list of date + time windows, shared by the request form and
 * the "suggest another time" counter flow. Controlled: the parent owns the
 * array so it can serialize and submit it.
 */
export function AvailabilityEditor({
  windows,
  onChange,
}: {
  windows: DraftWindow[]
  onChange: (next: DraftWindow[]) => void
}) {
  const update = (index: number, patch: Partial<DraftWindow>) =>
    onChange(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  const remove = (index: number) => onChange(windows.filter((_, i) => i !== index))
  const add = () => onChange([...windows, emptyWindow()])

  return (
    <div className="flex flex-col gap-3">
      {windows.map((w, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{`Option ${i + 1}`}</span>
            {windows.length > 1 ? (
              <button
                type="button"
                onClick={() => remove(i)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden />
                Remove
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`vous-date-${i}`}>Date</Label>
            <Input
              id={`vous-date-${i}`}
              type="date"
              min={todayISO()}
              value={w.date}
              onChange={(e) => update(i, { date: e.target.value })}
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`vous-start-${i}`}>From</Label>
              <Input
                id={`vous-start-${i}`}
                type="time"
                value={w.start}
                onChange={(e) => update(i, { start: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`vous-end-${i}`}>To</Label>
              <Input
                id={`vous-end-${i}`}
                type="time"
                value={w.end}
                onChange={(e) => update(i, { end: e.target.value })}
                className="h-12"
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="h-11">
        <Plus className="size-4" aria-hidden />
        Add another time
      </Button>
    </div>
  )
}
