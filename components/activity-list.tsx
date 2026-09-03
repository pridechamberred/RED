import { ACTIVITY_LABELS, type ActivityType, type ActivityRow, formatDate, formatMoney } from "@/lib/types"
import {
  Handshake,
  Gift,
  BadgeDollarSign,
  Heart,
  CalendarCheck,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react"

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  vous: Handshake,
  referral: Gift,
  done_deal: BadgeDollarSign,
  volunteering: Heart,
  chamber_event: CalendarCheck,
  meeting_attendance: ClipboardCheck,
}

const BADGE_BASE = "w-fit rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]"

/**
 * Badge styling per attendance status. Substitute gets its own treatment rather
 * than reusing the attended or absent style, so the feed never implies a
 * substitute was one or the other.
 */
const ATTENDANCE_BADGE: Record<"attended" | "absent" | "substitute", { label: string; className: string }> = {
  attended: { label: "Attended", className: `${BADGE_BASE} bg-primary/10 text-primary` },
  absent: { label: "Absent", className: `${BADGE_BASE} bg-secondary text-muted-foreground` },
  substitute: { label: "Substitute", className: `${BADGE_BASE} bg-muted text-foreground` },
}

/** The human-readable middle line for a feed row. */
function describe(row: ActivityRow) {
  switch (row.type) {
    case "vous":
      return row.otherMemberName ?? "1:1 meeting"
    case "referral":
      return `${row.subject} → ${row.otherMemberName ?? "a member"}`
    case "done_deal":
      return row.recurring ? "Recurring deal" : "One-off deal"
    case "volunteering":
      return row.subject ?? "Volunteering"
    case "chamber_event":
      return row.subject ?? "Chamber event"
    case "meeting_attendance":
      return row.subject ?? "RED meeting"
  }
}

function metric(row: ActivityRow) {
  if (row.type === "done_deal" && row.value !== null) {
    if (row.recurring && row.recurringValue !== null && row.recurringFrequency) {
      return `${formatMoney(row.value)} · ${formatMoney(row.recurringValue)}/${row.recurringFrequency}`
    }
    return `${formatMoney(row.value)}${row.recurring ? " recurring" : ""}`
  }
  if (row.hours !== null) {
    return `${row.hours} ${row.hours === 1 ? "hour" : "hours"}`
  }
  return null
}

export function ActivityList({
  rows,
  showMemberName = false,
  emptyMessage = "Nothing recorded yet.",
}: {
  rows: ActivityRow[]
  /** Admin views show who recorded each item. */
  showMemberName?: boolean
  emptyMessage?: string
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const value = metric(row)
        const Icon = ACTIVITY_ICON[row.type]
        return (
          <li
            key={`${row.type}-${row.id}`}
            className="flex items-start gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Icon className="size-4" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-bold uppercase tracking-[0.06em]">{ACTIVITY_LABELS[row.type]}</span>
                {showMemberName ? (
                  <span className="text-xs font-medium text-muted-foreground">{row.memberName}</span>
                ) : null}
              </div>
              <span className="text-sm leading-relaxed text-pretty">{describe(row)}</span>
              {row.type === "meeting_attendance" && row.attendanceStatus ? (
                <span className={ATTENDANCE_BADGE[row.attendanceStatus].className}>
                  {ATTENDANCE_BADGE[row.attendanceStatus].label}
                </span>
              ) : null}
              {row.type === "done_deal" && row.referralSourceLabel ? (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Referral from: {row.referralSourceLabel}
                </span>
              ) : null}
              {value ? <span className="text-sm font-semibold text-primary">{value}</span> : null}
            </div>

            <time
              dateTime={row.date}
              className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground"
            >
              {formatDate(row.date)}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
