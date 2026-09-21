"use client"

import { Button } from "@/components/ui/button"
import { CalendarPlus, Download } from "lucide-react"
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/vous"

/**
 * Lightweight add-to-calendar: a Google Calendar template link (covers most
 * members on a phone) plus a downloadable .ics (Apple Calendar, Outlook).
 * Everything is derived from the precomputed UTC instants passed in — no
 * network, no extra dependency.
 */
export function AddToCalendar({ event, uid }: { event: CalendarEvent; uid: string }) {
  function downloadIcs() {
    const blob = new Blob([buildIcs({ ...event, uid })], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "vous.ics"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2.5">
      <Button
        render={<a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
        size="lg"
        className="h-12 w-full text-base"
      >
        <CalendarPlus className="size-5" aria-hidden />
        Add to Google Calendar
      </Button>
      <Button type="button" onClick={downloadIcs} variant="outline" size="lg" className="h-12 w-full text-base">
        <Download className="size-5" aria-hidden />
        Download calendar file
      </Button>
    </div>
  )
}
