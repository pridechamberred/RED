"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { triggerPrideChamberSync, type ManualSyncResult } from "@/app/admin/pride-chamber/actions"
import { formatLongDate } from "@/lib/eastern-date"
import type { PrideChamberEventOption } from "@/lib/types"
import type { SyncRun } from "@/lib/pride-chamber-sync"

/** "Sep 13, 2026, 4:02 AM" in Orlando time, from an ISO timestamp. */
function formatRunTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function PrideChamberAdmin({
  events,
  runs,
}: {
  events: PrideChamberEventOption[]
  runs: SyncRun[]
}) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<ManualSyncResult | null>(null)

  const latest = runs[0] ?? null

  async function onSync() {
    setSyncing(true)
    setResult(null)
    try {
      setResult(await triggerPrideChamberSync())
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Sync</h2>
            <p className="text-sm text-muted-foreground">
              Runs automatically each morning. Trigger it by hand if the list looks out of date.
            </p>
          </div>
          <Button onClick={onSync} disabled={syncing} size="sm" className="h-9 shrink-0">
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>

        {result ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              result.ok
                ? "border-border bg-muted/40 text-foreground"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}
            role="status"
          >
            {result.ok
              ? `Sync complete — ${result.eventsFound} eligible event${result.eventsFound === 1 ? "" : "s"}, ${result.eventsUpserted} updated, ${result.eventsDeactivated} retired.`
              : `Sync failed: ${result.error} The previously imported events are still in use.`}
          </p>
        ) : latest ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Last run {formatRunTime(latest.ran_at)} ({latest.trigger}) —{" "}
            {latest.ok ? `${latest.events_found} eligible, ${latest.events_upserted} updated` : `failed: ${latest.error}`}.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Eligible events ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No eligible events. They appear here once the calendar has events in the previous 31 days.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium">{event.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{formatLongDate(event.eventDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Recent syncs</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No sync has run yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{formatRunTime(run.ran_at)}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      run.ok ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {run.ok ? "OK" : "Failed"} · {run.trigger}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {run.ok
                    ? `${run.events_found} eligible · ${run.events_upserted} updated · ${run.events_deactivated} retired`
                    : run.error}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
