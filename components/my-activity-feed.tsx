"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { PaginatedActivityList } from "@/components/paginated-activity-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { filterActivityRows } from "@/lib/report-filters"
import { ACTIVITY_LABELS, type ActivityRow, type ActivityType } from "@/lib/types"

// Attendance is never part of the activity feed, so offering it would always be empty.
const ACTIVITY_TYPES = (Object.keys(ACTIVITY_LABELS) as ActivityType[]).filter(
  (t) => t !== "meeting_attendance",
)

export function MyActivityFeed({ rows }: { rows: ActivityRow[] }) {
  const [showFilters, setShowFilters] = useState(false)
  const [type, setType] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const filtered = useMemo(
    () => filterActivityRows(rows, { member: "all", subGroup: "all", type, from, to }),
    [rows, type, from, to],
  )

  const totals = useMemo(() => {
    const counts = new Map<ActivityType, number>()
    for (const row of filtered) counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
    return counts
  }, [filtered])

  const activeFilters = [type !== "all", from !== "", to !== ""].filter(Boolean).length
  const visibleTypes = type === "all" ? ACTIVITY_TYPES : [type as ActivityType]
  const rangeInvalid = from !== "" && to !== "" && from > to

  function clearFilters() {
    setType("all")
    setFrom("")
    setTo("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="my-activity-filters"
            className="h-11 flex-1 justify-between"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filter by type and date
            </span>
            {activeFilters > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>

          {activeFilters > 0 ? (
            <Button type="button" variant="ghost" onClick={clearFilters} className="h-11 gap-1.5">
              <X className="size-4" aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>

        {showFilters ? (
          <div
            id="my-activity-filters"
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="my-filter-type">Activity type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "all")}>
                <SelectTrigger id="my-filter-type" className="h-11 w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v && v !== "all" ? ACTIVITY_LABELS[v as ActivityType] : "All types"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACTIVITY_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="my-filter-from">From</Label>
                <Input
                  id="my-filter-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="my-filter-to">To</Label>
                <Input
                  id="my-filter-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {rangeInvalid ? (
              <p role="alert" className="text-sm text-destructive">
                The &quot;From&quot; date must be on or before the &quot;To&quot; date.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <section aria-labelledby="activity-totals-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="activity-totals-heading"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Totals
            </h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {rangeLabel(from, to)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleTypes.map((t) => (
              <div key={t} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-3">
                <dt className="text-xs text-muted-foreground">{ACTIVITY_LABELS[t]}</dt>
                <dd className="text-2xl font-bold tabular-nums">{totals.get(t) ?? 0}</dd>
              </div>
            ))}
            {type === "all" ? (
              <div className="flex flex-col gap-0.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3">
                <dt className="text-xs text-muted-foreground">All activity</dt>
                <dd className="text-2xl font-bold tabular-nums">{filtered.length}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <PaginatedActivityList
        rows={filtered}
        emptyMessage={
          rows.length === 0
            ? "Nothing recorded yet. Search a member on the home screen to start."
            : "No activity matches these filters."
        }
      />
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function rangeLabel(from: string, to: string) {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `From ${formatDate(from)}`
  if (to) return `Up to ${formatDate(to)}`
  return "All time"
}
