"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ActivityList } from "@/components/activity-list"
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
import { ChevronRight, ClipboardCheck, SlidersHorizontal, UserPlus } from "lucide-react"

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

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (subGroup !== "all" && row.memberSubGroup !== subGroup) return false
      if (member !== "all" && row.memberId !== member) return false
      if (type !== "all" && row.type !== type) return false
      if (from && row.date < from) return false
      if (to && row.date > to) return false
      return true
    })
  }, [rows, subGroup, member, type, from, to])

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
    for (const row of filtered) {
      if (row.type === "done_deal" && row.value !== null) dealValue += row.value
      // Scoped to volunteering on purpose: chamber_events still has an unused
      // legacy `hours` column, and a stray value there must not inflate a stat
      // labelled "Volunteer Hours".
      if (row.type === "volunteering" && row.hours !== null) hours += row.hours
      if (row.type === "vous") vous += 1
      // One chamber_event row = one member attending one event.
      if (row.type === "chamber_event") eventAttendees += 1
    }
    return { dealValue, hours, vous, eventAttendees }
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{scopeLabel}</p>
      </header>

      <Link
        href="/admin/attendance"
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
      >
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <ClipboardCheck className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold leading-tight">Attendance Record</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Mark who came to each RED meeting
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <dl className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Activities", value: String(filtered.length) },
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

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="h-11 justify-between"
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

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Activity feed</h2>
        <ActivityList rows={filtered} showMemberName emptyMessage="No activity matches these filters." />
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
