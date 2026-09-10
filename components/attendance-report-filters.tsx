"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SUB_GROUPS, type SubGroup } from "@/lib/types"

/**
 * Filter bar for the attendance report.
 *
 * The report itself is computed on the server (it needs the calendar and the
 * register), so changing a filter navigates with new query params rather than
 * filtering in place. Inputs are seeded from the server-resolved values and
 * push updates to the URL on change.
 */
export function AttendanceReportFilters({
  from,
  to,
  group,
  canFilterSubGroup,
}: {
  from: string
  to: string
  /** The active sub-group, or null for "all". */
  group: SubGroup | null
  /** Super-admins only — the single-group admins have nothing to choose. */
  canFilterSubGroup: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  function commit(next: Partial<{ from: string; to: string; group: string }>) {
    const params = new URLSearchParams(searchParams?.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      {canFilterSubGroup ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-sub-group">Sub-group</Label>
          <Select
            value={group ?? "all"}
            onValueChange={(v) => commit({ group: v && v !== "all" ? v : "" })}
          >
            <SelectTrigger id="report-sub-group" className="h-11 w-full">
              <SelectValue>{(v: string | null) => (v && v !== "all" ? v : "All sub-groups")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sub-groups</SelectItem>
              {SUB_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={localFrom}
            max={localTo || undefined}
            onChange={(e) => {
              setLocalFrom(e.target.value)
              if (e.target.value) commit({ from: e.target.value })
            }}
            className="h-11"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={localTo}
            min={localFrom || undefined}
            onChange={(e) => {
              setLocalTo(e.target.value)
              if (e.target.value) commit({ to: e.target.value })
            }}
            className="h-11"
          />
        </div>
      </div>
    </div>
  )
}
