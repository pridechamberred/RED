"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react"

export type MeetingTile = {
  id: string
  /** ISO instant, for the <time> element. */
  startISO: string
  /** e.g. "Tue, Sep 8" — formatted on the server so SSR and the client agree. */
  day: string
  /** e.g. "11:30 AM EDT" */
  time: string
  group: string
  /** Venue name (text before the first comma), or null. */
  venue: string | null
  /** Remainder of the address, or null. */
  venueDetail: string | null
  online: boolean
}

export function MeetingScroller({ title, meetings }: { title: string; meetings: MeetingTile[] }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    // A sub-pixel gap is normal at the far end, so allow a small tolerance.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    sync()
    const el = trackRef.current
    if (!el) return
    // Arrows must also settle when the container resizes, not just on scroll.
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sync])

  const nudge = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Arrows sit beside the heading rather than over the track, so they can
          never cover a venue or date. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
        <div className="hidden items-center gap-1.5 sm:flex">
          <ScrollArrow direction="left" disabled={atStart} onClick={() => nudge(-1)} />
          <ScrollArrow direction="right" disabled={atEnd} onClick={() => nudge(1)} />
        </div>
      </div>

      <ul
        ref={trackRef}
        onScroll={sync}
        tabIndex={0}
        aria-label="Upcoming RED meetings"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {meetings.map((meeting, index) => (
          <li
            key={meeting.id}
            className="flex min-w-[15.5rem] max-w-[15.5rem] snap-start flex-col gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              {index === 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-primary-foreground">
                  Next
                </span>
              ) : null}
              <span className="truncate text-xs font-bold uppercase tracking-[0.06em] text-accent-foreground">
                {meeting.group}
              </span>
            </div>

            <div className="flex flex-col">
              <time dateTime={meeting.startISO} className="text-lg font-bold leading-tight tracking-tight">
                {meeting.day}
              </time>
              <span className="text-sm font-semibold leading-relaxed text-muted-foreground">{meeting.time}</span>
            </div>

            <div className="mt-auto flex items-start gap-2 border-t border-border pt-3">
              <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
                {meeting.online ? <Video className="size-4" /> : <MapPin className="size-4" />}
              </span>
              {meeting.venue ? (
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold leading-snug">{meeting.venue}</span>
                  {meeting.venueDetail ? (
                    <span className="text-xs leading-relaxed text-muted-foreground">{meeting.venueDetail}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-sm leading-snug text-muted-foreground">
                  {/* An online group with no address isn't missing a venue. */}
                  {meeting.online ? "Online meeting" : "Venue to be confirmed"}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScrollArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right"
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Show earlier meetings" : "Show later meetings"}
      className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent disabled:opacity-35 disabled:hover:bg-card"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
