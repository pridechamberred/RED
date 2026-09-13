"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"
import { runPrideChamberSync, type SyncSummary } from "@/lib/pride-chamber-sync"

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
