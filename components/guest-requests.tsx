"use client"

import { useState, useTransition } from "react"
import { Check, X } from "lucide-react"
import { setGuestRequestDecision } from "@/app/admin/guest-requests-actions"
import type { GuestRequest, GuestRequestDecision } from "@/lib/data"
import { cn } from "@/lib/utils"

const meetingFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const OPTIONS: { value: GuestRequestDecision; label: string; icon: typeof Check; active: string }[] = [
  { value: "approved", label: "Approve", icon: Check, active: "bg-primary text-primary-foreground" },
  { value: "denied", label: "Deny", icon: X, active: "bg-foreground text-background" },
]

function DecisionToggle({ request }: { request: GuestRequest }) {
  const [decision, setDecision] = useState<GuestRequestDecision | null>(request.decision)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(next: GuestRequestDecision) {
    if (next === decision) return
    const previous = decision
    setDecision(next)
    setError(null)
    startTransition(async () => {
      const result = await setGuestRequestDecision(request.id, next)
      if (!result.ok) {
        setDecision(previous)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div
        role="group"
        aria-label={`Decision for ${request.guestName}`}
        className={cn(
          "flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1",
          pending && "opacity-60",
        )}
      >
        {OPTIONS.map(({ value, label, icon: Icon, active }) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={decision === value}
            disabled={pending}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              decision === value ? active : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <span role="alert" className="max-w-[14rem] text-right text-[0.6875rem] leading-snug text-destructive">
          {error}
        </span>
      ) : (
        <span className="pr-1 text-[0.6875rem] font-medium text-muted-foreground">
          {decision === "approved" ? "Approved" : decision === "denied" ? "Denied" : "Pending"}
        </span>
      )}
    </div>
  )
}

export function GuestRequests({ requests }: { requests: GuestRequest[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Guest Requests</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {"Folks who've submitted a guest request for an upcoming meeting:"}
      </p>

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No guest requests for upcoming meetings.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold leading-tight">{r.guestName}</span>
                <a
                  href={`mailto:${r.guestEmail}`}
                  className="truncate text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  {r.guestEmail}
                </a>
                {r.guestCompany ? <span className="truncate text-sm text-muted-foreground">{r.guestCompany}</span> : null}
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {`${r.meetingTitle ?? r.subGroup}${r.meetingStart ? ` · ${meetingFormat.format(new Date(r.meetingStart))}` : ""}`}
                </span>
                <span className="text-xs text-muted-foreground">{`Guest of ${r.invitedBy}`}</span>
              </div>
              <DecisionToggle request={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
