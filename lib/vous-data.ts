import "server-only"

import { createClient } from "@/lib/supabase/server"
import { easternTodayISO } from "@/lib/eastern-date"
import {
  isVousLocationKey,
  normalizeWindow,
  type VousLocationKey,
  type VousParty,
  type VousRequestRecord,
  type VousStatus,
  type VousWindow,
} from "@/lib/vous"

// The two participants are embedded by their FK constraint names (Postgres
// default <table>_<column>_fkey), so a request arrives with both members'
// display facts in a single round trip. public.members is readable by every
// authenticated user, so this resolves regardless of sub-group.
const REQUEST_FIELDS = `
  id, status, proposed_by, proposed_windows, locations, location_other, message,
  confirmed_date, confirmed_start, confirmed_end, confirmed_location, confirmed_location_other,
  created_at,
  inviter:members!vous_requests_inviter_id_fkey(id, first_name, last_name, company),
  invitee:members!vous_requests_invitee_id_fkey(id, first_name, last_name, company)
`

type RawParty = { id: string; first_name: string; last_name: string; company: string | null }

type RawRequest = {
  id: string
  status: VousStatus
  proposed_by: string
  proposed_windows: unknown
  locations: string[] | null
  location_other: string | null
  message: string | null
  confirmed_date: string | null
  confirmed_start: string | null
  confirmed_end: string | null
  confirmed_location: string | null
  confirmed_location_other: string | null
  created_at: string
  inviter: RawParty | null
  invitee: RawParty | null
}

function party(raw: RawParty | null): VousParty {
  return {
    id: raw?.id ?? "",
    firstName: raw?.first_name ?? "A",
    lastName: raw?.last_name ?? "member",
    company: raw?.company ?? null,
  }
}

function parseWindows(raw: unknown): VousWindow[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeWindow).filter((w): w is VousWindow => w !== null)
}

function parseLocations(raw: string[] | null): VousLocationKey[] {
  return (raw ?? []).filter(isVousLocationKey)
}

function toRecord(raw: RawRequest): VousRequestRecord {
  return {
    id: raw.id,
    status: raw.status,
    inviter: party(raw.inviter),
    invitee: party(raw.invitee),
    proposedBy: raw.proposed_by,
    windows: parseWindows(raw.proposed_windows),
    locations: parseLocations(raw.locations),
    locationOther: raw.location_other,
    message: raw.message,
    confirmed:
      raw.status === "confirmed" && raw.confirmed_date && raw.confirmed_start && raw.confirmed_end
        ? {
            date: raw.confirmed_date,
            start: raw.confirmed_start,
            end: raw.confirmed_end,
            location:
              raw.confirmed_location && isVousLocationKey(raw.confirmed_location)
                ? raw.confirmed_location
                : null,
            locationOther: raw.confirmed_location_other,
          }
        : null,
    createdAt: raw.created_at,
  }
}

/**
 * A single request, or null when it does not exist or the caller is not one of
 * its two participants (RLS returns no row). The `as unknown as` cast mirrors
 * lib/data.ts: Supabase's generated types widen a to-one embed to an array,
 * while a single FK returns one row at runtime.
 */
export async function getVousRequest(id: string): Promise<VousRequestRecord | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("vous_requests").select(REQUEST_FIELDS).eq("id", id).maybeSingle()
  if (error) {
    console.log("[v0] getVousRequest error:", error.message)
    return null
  }
  if (!data) return null
  return toRecord(data as unknown as RawRequest)
}

export type VousSummary = {
  /** Requests waiting on ME to respond (I'm the participant who didn't propose). */
  actionable: VousRequestRecord[]
  /** Confirmed vous still to come, soonest first. */
  upcoming: VousRequestRecord[]
}

/**
 * The signed-in member's Vous at a glance, for the dashboard card. Reads every
 * request they are part of (RLS already scopes to the two participants) and
 * buckets them. Never throws — a missing table (migration 017 not run yet)
 * returns empty buckets so the home page still renders.
 */
export async function getVousSummary(memberId: string): Promise<VousSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vous_requests")
    .select(REQUEST_FIELDS)
    .in("status", ["pending", "counter_proposed", "confirmed"])
    .order("created_at", { ascending: false })

  if (error) {
    console.log("[v0] getVousSummary error:", error.message)
    return { actionable: [], upcoming: [] }
  }

  const records = (data as unknown as RawRequest[]).map(toRecord)
  const today = easternTodayISO()

  const actionable = records.filter(
    (r) => (r.status === "pending" || r.status === "counter_proposed") && r.proposedBy !== memberId,
  )

  const upcoming = records
    .filter((r) => r.status === "confirmed" && r.confirmed && r.confirmed.date >= today)
    .sort((a, b) => {
      const aKey = `${a.confirmed!.date} ${a.confirmed!.start}`
      const bKey = `${b.confirmed!.date} ${b.confirmed!.start}`
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0
    })

  return { actionable, upcoming }
}

/**
 * Is there already a live vous between these two members? Used to steer a new
 * request away from creating a duplicate. Returns the id of an existing
 * pending/counter/confirmed(-upcoming) request, or null.
 */
export async function findExistingLiveVous(
  memberA: string,
  memberB: string,
): Promise<{ id: string; status: VousStatus } | null> {
  const supabase = await createClient()
  const today = easternTodayISO()
  const { data, error } = await supabase
    .from("vous_requests")
    .select("id, status, confirmed_date, inviter_id, invitee_id")
    .in("status", ["pending", "counter_proposed", "confirmed"])

  if (error) {
    console.log("[v0] findExistingLiveVous error:", error.message)
    return null
  }

  const match = (data ?? []).find((r) => {
    const row = r as {
      id: string
      status: VousStatus
      confirmed_date: string | null
      inviter_id: string
      invitee_id: string
    }
    const between =
      (row.inviter_id === memberA && row.invitee_id === memberB) ||
      (row.inviter_id === memberB && row.invitee_id === memberA)
    if (!between) return false
    // A confirmed vous only blocks while it is still in the future.
    if (row.status === "confirmed") return !row.confirmed_date || row.confirmed_date >= today
    return true
  }) as { id: string; status: VousStatus } | undefined

  return match ? { id: match.id, status: match.status } : null
}
