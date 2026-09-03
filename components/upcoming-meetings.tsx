import { CALENDAR_TIME_ZONE, getUpcomingMeetings } from "@/lib/calendar"
import { MeetingScroller, type MeetingTile } from "@/components/meeting-scroller"

/**
 * Dates are formatted here, on the server, with an explicit timeZone — if the
 * client re-formatted them it would use the viewer's own zone and produce
 * different text than the server rendered, which React reports as a hydration
 * mismatch. Meetings are physical and in Orlando, so the venue's local time is
 * also the correct thing to show a travelling member.
 */
const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
})

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

/** Splits "Venue Name, 123 St, City, FL 32803, USA" into name + address. */
function splitLocation(location: string | null): { venue: string | null; venueDetail: string | null } {
  if (!location) return { venue: null, venueDetail: null }

  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.toUpperCase() !== "USA")

  if (parts.length === 0) return { venue: null, venueDetail: null }

  return {
    venue: parts[0],
    venueDetail: parts.length > 1 ? parts.slice(1).join(", ") : null,
  }
}

export async function UpcomingMeetings() {
  const meetings = await getUpcomingMeetings(20)

  const tiles: MeetingTile[] = meetings.map((meeting) => {
    const start = new Date(meeting.startISO)
    const { venue, venueDetail } = splitLocation(meeting.location)

    return {
      id: meeting.id,
      startISO: meeting.startISO,
      day: dayFormat.format(start),
      time: timeFormat.format(start),
      group: meeting.title,
      venue,
      venueDetail,
      online: /zoom|online|virtual/i.test(`${meeting.title} ${meeting.location ?? ""}`),
    }
  })

  if (tiles.length === 0) {
    return (
      <section className="mt-10 flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">UPCOMING MEETINGS...</h2>
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-sm leading-relaxed text-muted-foreground">
          Meeting dates are unavailable right now. Please try again shortly.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <MeetingScroller title="UPCOMING MEETINGS..." meetings={tiles} />
    </section>
  )
}
