"use client"

import { useEffect, useRef, useState, useTransition } from "react"
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

const SUBSTITUTE_NAME_MAX = 120

/**
 * Attendance control: Attended, Absent, Substitute (members only), or neither.
 *
 * "Neither" is a real state, not a styling accident — it means no admin has
 * ruled on this person yet, which reports must not confuse with a confirmed
 * absence. Clearing is therefore offered explicitly rather than by toggling the
 * active option off, which would be ambiguous.
 *
 * When Substitute is active an optional free-text box appears for the stand-in's
 * name. It saves on blur / Enter rather than per keystroke — the register is a
 * long column of controls and one write per keypress would be needless churn.
 */
export function AttendanceToggle({
  meetingId,
  subjectKind,
  subjectId,
  name,
  initial,
  initialSubstituteName = null,
}: {
  meetingId: string
  subjectKind: "member" | "guest"
  subjectId: string
  /** Used for the screen-reader label, so each control is distinguishable. */
  name: string
  initial: AttendanceMark
  /** Only meaningful for members marked substitute; null otherwise. */
  initialSubstituteName?: string | null
}) {
  const [mark, setMark] = useState<AttendanceMark>(initial)
  const [subName, setSubName] = useState(initialSubstituteName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // The last name value we actually persisted, so a blur with no real change
  // (e.g. tabbing straight through the field) does not fire a redundant save.
  const savedSubName = useRef(initialSubstituteName ?? "")
  const subInputRef = useRef<HTMLInputElement>(null)

  // Substitute applies to members only: a one-off visitor either turned up or
  // didn't. The server enforces this too, so hiding it here is presentation,
  // not the security boundary.
  const statuses = subjectKind === "member" ? MEMBER_STATUSES : GUEST_STATUSES

  // Focus the name box the moment Substitute becomes active by a click, so an
  // admin can type straight away. Skipped on first render (the effect's deps
  // start equal) so existing substitute rows do not steal focus on page load.
  const wasSubstitute = useRef(mark === "substitute")
  useEffect(() => {
    if (mark === "substitute" && !wasSubstitute.current) subInputRef.current?.focus()
    wasSubstitute.current = mark === "substitute"
  }, [mark])

  function persist(status: AttendanceStatus | "clear", nameValue: string) {
    const form = new FormData()
    form.set("meetingId", meetingId)
    form.set("subjectKind", subjectKind)
    form.set("subjectId", subjectId)
    form.set("value", status)
    form.set("substituteName", nameValue)

    startTransition(async () => {
      const result = await setAttendance(form)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Remember what stuck, so the next blur can tell a real edit from a no-op.
      savedSubName.current = status === "substitute" ? nameValue.trim() : ""
      setError(null)
      router.refresh()
    })
  }

  function choose(value: AttendanceStatus | "clear") {
    const next = value === "clear" ? null : value
    if (next === mark) return

    const previous = mark
    setMark(next) // optimistic — a register is a lot of taps in a row
    setError(null)

    // Leaving Substitute discards any typed name, matching the server, which
    // forces the column to null for every non-substitute status.
    const nameForWrite = value === "substitute" ? subName.trim() : ""
    if (value !== "substitute") setSubName("")

    // Roll the optimistic status back if the write fails.
    const form = new FormData()
    form.set("meetingId", meetingId)
    form.set("subjectKind", subjectKind)
    form.set("subjectId", subjectId)
    form.set("value", value)
    form.set("substituteName", nameForWrite)

    startTransition(async () => {
      const result = await setAttendance(form)
      if (!result.ok) {
        setMark(previous)
        setError(result.error)
        return
      }
      savedSubName.current = value === "substitute" ? nameForWrite : ""
      router.refresh()
    })
  }

  function commitName() {
    if (mark !== "substitute") return
    const trimmed = subName.trim()
    if (trimmed === savedSubName.current) return // nothing actually changed
    if (trimmed.length > SUBSTITUTE_NAME_MAX) {
      setError(`That substitute name is too long (${SUBSTITUTE_NAME_MAX} characters max).`)
      return
    }
    persist("substitute", trimmed)
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
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
              onClick={() => choose(status)}
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

      {/* Optional stand-in name, shown only while Substitute is the active mark. */}
      {mark === "substitute" ? (
        <input
          ref={subInputRef}
          type="text"
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              subInputRef.current?.blur()
            }
          }}
          maxLength={SUBSTITUTE_NAME_MAX}
          disabled={pending}
          placeholder="Substitute's name (optional)"
          aria-label={`Substitute's name for ${name}`}
          className="w-56 max-w-[70vw] rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : null}

      {mark === null ? (
        <span className="pr-1 text-[0.6875rem] font-medium text-muted-foreground">Not recorded</span>
      ) : (
        <button
          type="button"
          onClick={() => choose("clear")}
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
