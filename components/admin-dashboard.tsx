"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PaginatedActivityList } from "@/components/paginated-activity-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ACTIVITY_LABELS,
  SUB_GROUPS,
  type ActivityRow,
  type ActivityType,
  type GuestInviteRow,
  type MemberOption,
  formatMoney,
  memberName,
} from "@/lib/types"
import { filterActivityRows } from "@/lib/report-filters"
import { ChevronRight, Download, SlidersHorizontal, UserPlus } from "lucide-react"

/** Reads the download filename the export route sets in Content-Disposition. */
function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return match ? match[1] : null
}

// Attendance never reaches this feed (it is per-member, not per-activity), so
// offering it as a filter would be a permanently empty result.
const ACTIVITY_TYPES = (Object.keys(ACTIVITY_LABELS) as ActivityType[]).filter(
  (t) => t !== "meeting_attendance",
)

export function AdminDashboard({
  rows,
  members,
  guestInvites,
  scopeLabel,
  canFilterSubGroup,
}: {
  rows: ActivityRow[]
  members: MemberOption[]
  guestInvites: GuestInviteRow[]
  scopeLabel: string
  /** Super-admins only: they are the only role that sees more than one group. */
  canFilterSubGroup: boolean
}) {
  const [member, setMember] = useState("all")
  const [type, setType] = useState("all")
  const [subGroup, setSubGroup] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null)

  // The feed and the XLSX export share one filter function so the spreadsheet
  // always contains exactly what the report on screen shows.
  const filtered = useMemo(
    () => filterActivityRows(rows, { member, type, subGroup, from, to }),
    [rows, subGroup, member, type, from, to],
  )

  /**
   * Guests are not activity rows, so they are filtered separately — by the same
   * member/sub-group/date bounds. The activity-type filter excludes them
   * entirely: narrowing to "Vous" should no more count guests than it counts
   * done deal value.
   */
  const guestCount = useMemo(() => {
    if (type !== "all") return 0
    return guestInvites.filter((g) => {
      if (subGroup !== "all" && g.memberSubGroup !== subGroup) return false
      if (member !== "all" && g.memberId !== member) return false
      if (from && g.date < from) return false
      if (to && g.date > to) return false
      return true
    }).length
  }, [guestInvites, subGroup, member, from, to, type])

  const totals = useMemo(() => {
    let dealValue = 0
    let hours = 0
    let vous = 0
    let eventAttendees = 0
    let referrals = 0
    for (const row of filtered) {
      if (row.type === "done_deal" && row.value !== null) dealValue += row.value
      // Scoped to volunteering on purpose: chamber_events still has an unused
      // legacy `hours` column, and a stray value there must not inflate a stat
      // labelled "Volunteer Hours".
      if (row.type === "volunteering" && row.hours !== null) hours += row.hours
      if (row.type === "vous") vous += 1
      // One chamber_event row = one member attending one event.
      if (row.type === "chamber_event") eventAttendees += 1
      // Passed referrals logged in the app. The type filter can narrow to just
      // these; the sub-group / member / date bounds still apply either way.
      if (row.type === "referral") referrals += 1
    }
    return { dealValue, hours, vous, eventAttendees, referrals }
  }, [filtered])

  const activeFilters = [
    member !== "all",
    type !== "all",
    subGroup !== "all",
    from !== "",
    to !== "",
  ].filter(Boolean).length

  // Members who appear in the visible data, for the member drill-down list.
  // Follows the sub-group filter so the member dropdown can't offer someone the
  // current filter would exclude anyway.
  const membersInScope = useMemo(() => {
    const ids = new Set(rows.map((r) => r.memberId))
    return members.filter(
      (m) => ids.has(m.id) && (subGroup === "all" || m.sub_group === subGroup),
    )
  }, [rows, members, subGroup])

  // Our group measures against two halves each year. "January – June" is always
  // the current year. "July – December" is the current year once we have
  // reached H2, but the previous year while we are still in H1 — that half has
  // not begun yet, so the most recent completed one is last year's.
  const now = new Date()
  const currentYear = now.getFullYear()
  const h2Year = now.getMonth() < 6 ? currentYear - 1 : currentYear
  const firstHalf = { from: `${currentYear}-01-01`, to: `${currentYear}-06-30` }
  const secondHalf = { from: `${h2Year}-07-01`, to: `${h2Year}-12-31` }
  const activeHalf =
    from === firstHalf.from && to === firstHalf.to
      ? "h1"
      : from === secondHalf.from && to === secondHalf.to
        ? "h2"
        : null

  // Let a success/empty note fade on its own; keep errors up until the next try.
  useEffect(() => {
    if (!exportMsg || exportMsg.tone === "error") return
    const timer = setTimeout(() => setExportMsg(null), 4000)
    return () => clearTimeout(timer)
  }, [exportMsg])

  async function handleExport() {
    // The report is already empty on screen, so short-circuit before any request.
    if (filtered.length === 0) {
      setExportMsg({ tone: "info", text: "There are no records matching the current filters." })
      return
    }
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member, type, subGroup, from, to }),
      })
      if (res.status === 422) {
        setExportMsg({ tone: "info", text: "There are no records matching the current filters." })
        return
      }
      if (!res.ok) throw new Error(`Export request failed with status ${res.status}`)

      const blob = await res.blob()
      const filename = filenameFromDisposition(res.headers.get("content-disposition")) ?? "RED_Report.xlsx"
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setExportMsg({ tone: "success", text: "Report exported successfully." })
    } catch (err) {
      console.error("[v0] XLSX export failed:", err)
      setExportMsg({ tone: "error", text: "We couldn't export this report. Please try again." })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{scopeLabel}</p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="h-11 flex-1 justify-between"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
            </span>
            {activeFilters > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>

          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Export the filtered report to an Excel (.xlsx) spreadsheet"
            className="h-11 gap-2"
          >
            <Download className="size-4" aria-hidden />
            {exporting ? "Generating XLSX..." : "Export XLSX"}
          </Button>
        </div>

        {exportMsg ? (
          <p
            role={exportMsg.tone === "error" ? "alert" : "status"}
            aria-live={exportMsg.tone === "error" ? "assertive" : "polite"}
            className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
              exportMsg.tone === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : exportMsg.tone === "success"
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {exportMsg.text}
          </p>
        ) : null}

        {showFilters ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
            {canFilterSubGroup ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-sub-group">Sub-group</Label>
                <Select
                  value={subGroup}
                  onValueChange={(v) => {
                    setSubGroup(v ?? "all")
                    // The chosen member may not belong to the new sub-group, which
                    // would silently empty the feed. Reset rather than mislead.
                    setMember("all")
                  }}
                >
                  <SelectTrigger id="filter-sub-group" className="h-11 w-full">
                    <SelectValue>
                      {(v: string | null) => (v && v !== "all" ? v : "All sub-groups")}
                    </SelectValue>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-member">Member</Label>
              <Select value={member} onValueChange={(v) => setMember(v ?? "all")}>
                <SelectTrigger id="filter-member" className="h-11 w-full">
                  <SelectValue>
                    {(v: string | null) => {
                      const found = membersInScope.find((m) => m.id === v)
                      return found ? memberName(found) : "All members"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {membersInScope.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {memberName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-type">Activity type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "all")}>
                <SelectTrigger id="filter-type" className="h-11 w-full">
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

            <div className="flex flex-col gap-2">
              <Label>Half-year</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={activeHalf === "h1" ? "default" : "outline"}
                  onClick={() => {
                    setFrom(firstHalf.from)
                    setTo(firstHalf.to)
                  }}
                  className="h-auto flex-1 flex-col gap-0.5 py-2"
                >
                  <span>January – June</span>
                  <span className="text-xs font-normal opacity-80">{currentYear}</span>
                </Button>
                <Button
                  type="button"
                  variant={activeHalf === "h2" ? "default" : "outline"}
                  onClick={() => {
                    setFrom(secondHalf.from)
                    setTo(secondHalf.to)
                  }}
                  className="h-auto flex-1 flex-col gap-0.5 py-2"
                >
                  <span>July – December</span>
                  <span className="text-xs font-normal opacity-80">{h2Year}</span>
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {activeFilters > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMember("all")
                  setType("all")
                  setSubGroup("all")
                  setFrom("")
                  setTo("")
                }}
                className="h-10"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Referrals", value: String(totals.referrals) },
          { label: "Done Deals", value: formatMoney(totals.dealValue) },
          { label: "Volunteer Hours", value: String(Math.round(totals.hours * 100) / 100) },
          { label: "Vous completed", value: String(totals.vous) },
          { label: "Guests invited", value: String(guestCount) },
          { label: "Event attendees", value: String(totals.eventAttendees) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-3.5 py-3">
            <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
            <dd className="truncate text-lg font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Activity feed</h2>
        <PaginatedActivityList rows={filtered} showMemberName emptyMessage="No activity matches these filters." />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Members</h2>
          <Button render={<Link href="/admin/add-member" />} nativeButton={false} size="sm" className="h-9">
            <UserPlus className="size-4" aria-hidden />
            Add a member
          </Button>
        </div>
        {membersInScope.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No member activity yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {membersInScope.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/member/${m.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-accent/60"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold leading-tight">{memberName(m)}</span>
                    <span className="truncate text-sm leading-relaxed text-muted-foreground">
                      {m.company ? `${m.company} · ${m.sub_group}` : m.sub_group}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
