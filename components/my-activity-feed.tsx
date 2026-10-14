"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal, RotateCcw } from "lucide-react"
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

export type DefaultRange = { label: string; from: string; to: string }

type Period = "last-meeting" | "all" | "custom"

export function MyActivityFeed({
  rows,
  defaultRange,
}: {
  rows: ActivityRow[]
  defaultRange: DefaultRange | null
}) {
  const initialPeriod: Period = defaultRange ? "last-meeting" : "all"

  const [showFilters, setShowFilters] = useState(false)
  const [type, setType] = useState("all")
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const from = period === "last-meeting" && defaultRange ? defaultRange.from : period === "custom" ? customFrom : ""
  const to = period === "last-meeting" && defaultRange ? defaultRange.to : period === "custom" ? customTo : ""

  const filtered = useMemo(
    () => filterActivityRows(rows, { member: "all", subGroup: "all", type, from, to }),
    [rows, type, from, to],
  )

  const totals = useMemo(() => {
    const counts = new Map<ActivityType, number>()
    for (const row of filtered) counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
    return counts
  }, [filtered])

  const isDefaultView = type === "all" && period === initialPeriod
  const visibleTypes = type === "all" ? ACTIVITY_TYPES : [type as ActivityType]
  const rangeInvalid = period === "custom" && customFrom !== "" && customTo !== "" && customFrom > customTo

  const periodLabel =
    period === "last-meeting" && defaultRange
      ? defaultRange.label
      : period === "custom"
        ? rangeLabel(customFrom, customTo)
        : "All time"

  function changePeriod(next: Period) {
    // Seed a custom range from whatever was showing so it's a tweak, not a restart.
    if (next === "custom" && period !== "custom") {
      setCustomFrom(from)
      setCustomTo(to)
    }
    setPeriod(next)
  }

  function resetFilters() {
    setType("all")
    setPeriod(initialPeriod)
    setCustomFrom("")
    setCustomTo("")
  }

  const periodOptions: { value: Period; label: string }[] = [
    ...(defaultRange ? [{ value: "last-meeting" as const, label: defaultRange.label }] : []),
    { value: "all", label: "All time" },
    { value: "custom", label: "Custom dates" },
  ]

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
          </Button>

          {!isDefaultView ? (
            <Button type="button" variant="ghost" onClick={resetFilters} className="h-11 gap-1.5">
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </Button>
          ) : null}
        </div>

        {showFilters ? (
          <div
            id="my-activity-filters"
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="my-filter-period">Period</Label>
              <Select value={period} onValueChange={(v) => changePeriod((v as Period) ?? initialPeriod)}>
                <SelectTrigger id="my-filter-period" className="h-11 w-full">
                  <SelectValue>
                    {(v: string | null) => periodOptions.find((o) => o.value === v)?.label ?? "All time"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {period === "custom" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="my-filter-from">From</Label>
                  <Input
                    id="my-filter-from"
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="my-filter-to">To</Label>
                  <Input
                    id="my-filter-to"
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            ) : null}

            {rangeInvalid ? (
              <p role="alert" className="text-sm text-destructive">
                The &quot;From&quot; date must be on or before the &quot;To&quot; date.
              </p>
            ) : null}

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
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <section aria-labelledby="activity-totals-heading" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2
              id="activity-totals-heading"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Totals
            </h2>
            <p className="text-sm font-medium text-pretty" aria-live="polite">
              {periodLabel}
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
            : period === "last-meeting"
              ? "Nothing logged since your last meeting yet."
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
