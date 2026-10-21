import { NextResponse, type NextRequest } from "next/server"
import { runMeetingEveReminders } from "@/lib/meeting-reminders"

export const dynamic = "force-dynamic"
// Sends are paced for Resend's rate limit, so a large group needs headroom.
export const maxDuration = 300

/**
 * Evening-before meeting reminder, scheduled by `vercel.json` at 22:00 and
 * 23:00 UTC. The job itself only sends during the 6pm hour in New York, so
 * exactly one of the two runs does anything, whatever the daylight-saving state.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const summary = await runMeetingEveReminders()
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 })
}
