import { NextResponse, type NextRequest } from "next/server"
import { runPrideChamberSync } from "@/lib/pride-chamber-sync"

// The scrape + upsert must run fresh every time and can take a few seconds.
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Daily Pride Chamber calendar sync, scheduled by `vercel.json`.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` with every invocation,
 * so the endpoint requires that header to match. With no secret configured it
 * refuses to run rather than sitting open to anyone who guesses the URL —
 * triggering a scrape is admin-only, and this is the unauthenticated path.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.log("[v0] pride-chamber cron: CRON_SECRET is not configured — refusing to run.")
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 })
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const summary = await runPrideChamberSync("cron")
  // 502 on a failed sync so the run shows red in Vercel's cron logs, but the
  // body still carries the detail either way.
  return NextResponse.json(summary, { status: summary.ok ? 200 : 502 })
}
