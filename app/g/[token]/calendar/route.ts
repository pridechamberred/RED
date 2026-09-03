import { getInviteHost, isValidInviteToken } from "@/lib/invite-link"
import { buildGoogleCalendarUrl, buildMeetingIcs } from "@/lib/ics"
import { GUEST_MEETING_LIMIT, getMeetingOptions } from "@/lib/meeting-options"
import { memberName } from "@/lib/types"

/**
 * Serves a one-event .ics file so a guest can add the meeting to Apple
 * Calendar or Outlook.
 *
 * A route handler rather than a client-side blob because iOS Safari handles a
 * real `text/calendar` response far more reliably than a generated blob URL —
 * it opens the system "Add Event" sheet directly.
 *
 * Public by design (the guest has no login), but it only ever echoes back
 * calendar data that is already public plus the host's display name, and the
 * meeting must exist in the live feed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!isValidInviteToken(token)) {
    return new Response("Not found", { status: 404 })
  }

  const url = new URL(request.url)
  const meetingId = url.searchParams.get("meeting")
  if (!meetingId) return new Response("Missing meeting", { status: 400 })

  const [host, meetings] = await Promise.all([getInviteHost(token), getMeetingOptions(GUEST_MEETING_LIMIT)])

  if (!host) return new Response("Not found", { status: 404 })

  const meeting = meetings.find((m) => m.id === meetingId)
  if (!meeting) return new Response("Meeting not found", { status: 404 })

  // Google Calendar is a redirect to their own "add event" screen rather than a
  // download, so anyone already signed in adds the meeting in a single tap.
  if (url.searchParams.get("provider") === "google") {
    return Response.redirect(buildGoogleCalendarUrl(meeting, memberName(host)), 302)
  }

  const ics = buildMeetingIcs(meeting, memberName(host))

  // Filename is built from the title rather than interpolated raw: a comma or
  // quote in a calendar title would otherwise break the header.
  const safeTitle = meeting.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle || "red-meeting"}.ics"`,
      // Meetings can move on the calendar, so this must not be cached.
      "Cache-Control": "no-store",
    },
  })
}
