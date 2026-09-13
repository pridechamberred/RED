import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { scrapePrideChamberEvents } from "@/lib/pride-chamber-calendar"
import { sendScraperFailureEmail } from "@/lib/email"

/**
 * The daily Pride Chamber calendar sync.
 *
 * Flow: scrape the previous 31 days -> (already filtered to non-future,
 * non-RED-Group events) -> upsert into `pride_chamber_events` -> deactivate rows
 * the calendar no longer returns. Idempotent: dedup is on the unique
 * `source_id`, so re-running only updates rows and never duplicates them.
 *
 * Failure is contained. If the scrape fails, the stored events are left exactly
 * as they were and an alert email goes to the maintainer — a chamber-website
 * outage must never empty the members' dropdown.
 */

export type SyncSummary = {
  ok: boolean
  eventsFound: number
  eventsUpserted: number
  eventsDeactivated: number
  error: string | null
  ranAt: string
}

export type SyncRun = {
  id: string
  ran_at: string
  ok: boolean
  events_found: number
  events_upserted: number
  events_deactivated: number
  error: string | null
  trigger: string
}

type AdminClient = ReturnType<typeof createAdminClient>

/** Postgres "undefined_table" — the whole table is missing (migration not run). */
const UNDEFINED_TABLE = "42P01"

function isMissingTable(code?: string, message?: string): boolean {
  return code === UNDEFINED_TABLE || (message ?? "").includes("pride_chamber")
}

export async function runPrideChamberSync(trigger: "cron" | "manual" = "cron"): Promise<SyncSummary> {
  const ranAt = new Date().toISOString()
  const supabase = createAdminClient()
  const result = await scrapePrideChamberEvents()

  // ---- Scrape failed: keep last-good data, log the run, alert the maintainer.
  if (!result.ok) {
    console.log(`[v0] pride-chamber sync failed: ${result.error}`)
    await recordRun(supabase, {
      ok: false,
      found: 0,
      upserted: 0,
      deactivated: 0,
      error: result.error,
      trigger,
    })
    // Emailing must never turn a scrape failure into a thrown request.
    await sendScraperFailureEmail({
      error: result.error,
      window: `${result.fromISO} to ${result.toISO}`,
      trigger,
    }).catch((e) => console.log("[v0] pride-chamber alert email threw:", e))

    return { ok: false, eventsFound: 0, eventsUpserted: 0, eventsDeactivated: 0, error: result.error, ranAt }
  }

  const events = result.events

  // ---- Upsert the eligible events. onConflict on source_id makes it idempotent.
  let upserted = 0
  if (events.length > 0) {
    const rows = events.map((e) => ({
      source_id: e.sourceId,
      title: e.title,
      event_date: e.eventDate,
      detail_url: e.detailUrl,
      is_active: true,
      last_seen_at: ranAt,
    }))

    const { error } = await supabase.from("pride_chamber_events").upsert(rows, { onConflict: "source_id" })
    if (error) {
      if (isMissingTable(error.code, error.message)) {
        const msg = "pride_chamber_events table is missing — run migration 013."
        console.log(`[v0] ${msg}`)
        return { ok: false, eventsFound: events.length, eventsUpserted: 0, eventsDeactivated: 0, error: msg, ranAt }
      }
      console.log("[v0] pride-chamber upsert error:", error.message)
      await recordRun(supabase, {
        ok: false,
        found: events.length,
        upserted: 0,
        deactivated: 0,
        error: error.message,
        trigger,
      })
      return { ok: false, eventsFound: events.length, eventsUpserted: 0, eventsDeactivated: 0, error: error.message, ranAt }
    }
    upserted = rows.length
  }

  // ---- Deactivate previously-imported events the calendar no longer returns
  // (rolled out of the window, retitled into an exclusion, or deleted upstream).
  //
  // Guarded on a non-empty scrape: if a 200 response ever parses to zero events
  // we keep the last-good list rather than blanking the whole dropdown. source
  // ids are digits, so the `in` list needs no quoting.
  let deactivated = 0
  if (events.length > 0) {
    const keepIds = events.map((e) => e.sourceId)
    const { data, error } = await supabase
      .from("pride_chamber_events")
      .update({ is_active: false })
      .eq("is_active", true)
      .not("source_id", "in", `(${keepIds.join(",")})`)
      .select("id")

    if (error) {
      console.log("[v0] pride-chamber deactivate error:", error.message)
    } else {
      deactivated = data?.length ?? 0
    }
  }

  await recordRun(supabase, {
    ok: true,
    found: events.length,
    upserted,
    deactivated,
    error: null,
    trigger,
  })
  console.log(`[v0] pride-chamber sync ok: found=${events.length} upserted=${upserted} deactivated=${deactivated}`)
  return { ok: true, eventsFound: events.length, eventsUpserted: upserted, eventsDeactivated: deactivated, error: null, ranAt }
}

async function recordRun(
  supabase: AdminClient,
  run: { ok: boolean; found: number; upserted: number; deactivated: number; error: string | null; trigger: string },
): Promise<void> {
  const { error } = await supabase.from("pride_chamber_sync_runs").insert({
    ok: run.ok,
    events_found: run.found,
    events_upserted: run.upserted,
    events_deactivated: run.deactivated,
    error: run.error,
    trigger: run.trigger,
  })
  // A missing log table (pre-013) must not fail the sync itself.
  if (error && !isMissingTable(error.code, error.message)) {
    console.log("[v0] pride-chamber sync-run log error:", error.message)
  }
}

/** Recent sync attempts, newest first. Read with the service-role client, so
 *  callers MUST gate on admin themselves before exposing the result. */
export async function getRecentSyncRuns(limit = 10): Promise<SyncRun[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("pride_chamber_sync_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (!isMissingTable(error.code, error.message)) console.log("[v0] getRecentSyncRuns error:", error.message)
    return []
  }
  return (data as SyncRun[]) ?? []
}
