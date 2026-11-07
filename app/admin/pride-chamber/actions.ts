"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"
import { MANUAL_SOURCE_PREFIX, runPrideChamberSync, type SyncSummary } from "@/lib/pride-chamber-sync"
import { createAdminClient } from "@/lib/supabase/admin"

export type ManualSyncResult = SyncSummary & { unauthorized?: boolean }

/**
 * Admin-triggered manual sync. Gated on an admin session — members never reach
 * this — and the actual scrape/upsert is the same idempotent routine the daily
 * cron runs, so triggering it by hand is always safe.
 */
export async function triggerPrideChamberSync(): Promise<ManualSyncResult> {
  const me = await getCurrentMember()
  if (!me || !isAdmin(me.role)) {
    return {
      ok: false,
      eventsFound: 0,
      eventsUpserted: 0,
      eventsDeactivated: 0,
      error: "You are not authorized to run this.",
      ranAt: new Date().toISOString(),
      unauthorized: true,
    }
  }

  const summary = await runPrideChamberSync("manual")

  // Refresh the diagnostics page and the members' form so a successful sync
  // shows up immediately in both.
  revalidatePath("/admin/pride-chamber")
  revalidatePath("/record/chamber-event")
  return summary
}

export type ManualEventResult = { ok: true } | { ok: false; error: string }

const TITLE_MAX = 200

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function refreshEventPages() {
  revalidatePath("/admin/pride-chamber")
  revalidatePath("/record/chamber-event")
}

/** Adds an event by hand. Past or future dates are allowed; members only see it
 *  in the attendance dropdown from its date onward. */
export async function addManualPrideChamberEvent(input: {
  title: string
  eventDate: string
}): Promise<ManualEventResult> {
  const me = await getCurrentMember()
  if (!me || !isAdmin(me.role)) return { ok: false, error: "You are not authorized to do this." }

  const title = (input.title ?? "").trim().replace(/\s+/g, " ")
  const eventDate = (input.eventDate ?? "").trim()
  if (!title) return { ok: false, error: "Please enter the event name." }
  if (title.length > TITLE_MAX) return { ok: false, error: `Event name must be ${TITLE_MAX} characters or fewer.` }
  if (!isValidISODate(eventDate)) return { ok: false, error: "Please choose a valid date." }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("pride_chamber_events")
    .select("id")
    .eq("is_active", true)
    .eq("event_date", eventDate)
    .ilike("title", title)
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, error: "An event with that name is already on the calendar for that date." }
  }

  const { error } = await supabase.from("pride_chamber_events").insert({
    source_id: `${MANUAL_SOURCE_PREFIX}${crypto.randomUUID()}`,
    title,
    event_date: eventDate,
    detail_url: null,
    is_active: true,
  })
  if (error) {
    console.log("[v0] addManualPrideChamberEvent error:", error.message)
    return { ok: false, error: "Couldn't save the event. Please try again." }
  }

  refreshEventPages()
  return { ok: true }
}

/** Retires a manually-added event. Soft delete, so any attendance already
 *  linked to it keeps pointing at a real row. */
export async function removeManualPrideChamberEvent(id: string): Promise<ManualEventResult> {
  const me = await getCurrentMember()
  if (!me || !isAdmin(me.role)) return { ok: false, error: "You are not authorized to do this." }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("pride_chamber_events")
    .update({ is_active: false })
    .eq("id", id)
    .like("source_id", `${MANUAL_SOURCE_PREFIX}%`)
  if (error) {
    console.log("[v0] removeManualPrideChamberEvent error:", error.message)
    return { ok: false, error: "Couldn't remove the event. Please try again." }
  }

  refreshEventPages()
  return { ok: true }
}
