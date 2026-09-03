"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Users, RotateCcw } from "lucide-react"
import { setAttendance } from "@/app/actions"
// Imported from the client-safe module, NOT `lib/attendance.ts` — that file is
// `server-only` and would drag `next/headers` into the client bundle.
import {
  GUEST_STATUSES,
  MEMBER_STATUSES,
  STATUS_LABEL,
  type AttendanceMark,
  type AttendanceStatus,
} from "@/lib/attendance-status"
import { cn } from "@/lib/utils"

const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  attended: Check,
  absent: X,
  substitute: Users,
}

/**
 * Selected-state styling per status. Three options need three visually distinct
 * "on" states, or the register becomes hard to scan down a long roster:
 * attended is the positive accent, absent is the heavy inverse, and substitute
 * is a muted middle weight matching its "present, but not personally" meaning.
 */
const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  attended: "bg-primary text-primary-foreground",
  absent: "bg-foreground text-background",
  substitute: "bg-muted-foreground text-background",
}

/**
 * Attendance control: Attended, Absent, Substitute (members only), or neither.
 *
 * "Neither" is a real state, not a styling accident — it means no admin has
 * ruled on this person yet, which reports must not confuse with a confirmed
 * absence. Clearing is therefore offered explicitly rather than by toggling the
 * active option off, which would be ambiguous.
 */
export function AttendanceToggle({
  meetingId,
  subjectKind,
  subjectId,
  name,
  initial,
}: {
  meetingId: string
  subjectKind: "member" | "guest"
  subjectId: string
  /** Used for the screen-reader label, so each control is distinguishable. */
  name: string
  initial: AttendanceMark
}) {
  const [mark, setMark] = useState<AttendanceMark>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Substitute applies to members only: a one-off visitor either turned up or
  // didn't. The server enforces this too, so hiding it here is presentation,
  // not the security boundary.
  const statuses = subjectKind === "member" ? MEMBER_STATUSES : GUEST_STATUSES

  function submit(value: AttendanceStatus | "clear") {
    const next = value === "clear" ? null : value
    if (next === mark) return

    const previous = mark
    setMark(next) // optimistic — a register is a lot of taps in a row
    setError(null)

    startTransition(async () => {
      const form = new FormData()
      form.set("meetingId", meetingId)
      form.set("subjectKind", subjectKind)
      form.set("subjectId", subjectId)
      form.set("value", value)

      const result = await setAttendance(form)

      if (!result.ok) {
        setMark(previous)
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div
        role="group"
        aria-label={`Attendance for ${name}`}
        className={cn(
          "flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1",
          pending && "opacity-60",
        )}
      >
        {statuses.map((status) => {
          const Icon = STATUS_ICON[status]
          const active = mark === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => submit(status)}
              aria-pressed={active}
              disabled={pending}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                active ? STATUS_ACTIVE[status] : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {STATUS_LABEL[status]}
            </button>
          )
        })}
      </div>

      {mark === null ? (
        <span className="pr-1 text-[0.6875rem] font-medium text-muted-foreground">Not recorded</span>
      ) : (
        <button
          type="button"
          onClick={() => submit("clear")}
          disabled={pending}
          className="flex items-center gap-1 pr-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Clear
        </button>
      )}

      {error ? (
        <span role="alert" className="max-w-[14rem] text-right text-[0.6875rem] leading-snug text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
