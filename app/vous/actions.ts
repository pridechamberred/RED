"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPublicOrigin } from "@/lib/site-url"
import { createClient } from "@/lib/supabase/server"
import { getCurrentMember, getMemberById } from "@/lib/data"
import { easternTodayISO } from "@/lib/eastern-date"
import { nyWallToUtc } from "@/lib/calendar"
import {
  sendVousCancelledEmail,
  sendVousConfirmedEmail,
  sendVousCounterEmail,
  sendVousRequestEmail,
} from "@/lib/email"
import { memberName } from "@/lib/types"
import { findExistingLiveVous, getVousRequest } from "@/lib/vous-data"
import {
  confirmedLocationLabel,
  formatTimeRange,
  formatVousDate,
  googleCalendarUrl,
  isVousLocationKey,
  minutesToTime,
  normalizeWindow,
  partyName,
  timeToMinutes,
  type VousLocationKey,
  type VousRequestRecord,
  type VousWindow,
} from "@/lib/vous"

export type VousResult = { ok: true; note?: string } | { ok: false; error: string }
export type VousCreateResult = { ok: true; id: string } | { ok: false; error: string; existingId?: string }

const GENERIC_ERROR = "We couldn't save that. Please try again."
const RACE_ERROR = "This Vous was just updated by the other person. Refresh to see the latest."
const MAX_WINDOWS = 10
const MESSAGE_MAX = 1000
const DEFAULT_DURATION = 60

function str(form: FormData, key: string) {
  const v = form.get(key)
  return typeof v === "string" ? v.trim() : ""
}

function optional(form: FormData, key: string) {
  const v = str(form, key)
  return v.length > 0 ? v : null
}

/** Parses + validates the windows JSON. Rejects empties, bad shapes, past dates. */
function parseWindows(form: FormData): VousWindow[] | { error: string } {
  const raw = form.get("windows")
  if (typeof raw !== "string") return { error: "Please add at least one time that works for you." }

  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return { error: GENERIC_ERROR }
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    return { error: "Please add at least one time that works for you." }
  }
  if (arr.length > MAX_WINDOWS) {
    return { error: `That's a lot of options — please keep it to ${MAX_WINDOWS} time windows or fewer.` }
  }

  const today = easternTodayISO()
  const out: VousWindow[] = []
  for (const item of arr) {
    const w = normalizeWindow(item)
    if (!w) return { error: "One of your time windows looks incomplete. Check the date, start and end." }
    if (w.date < today) return { error: "Those times are in the past — please choose upcoming dates." }
    out.push(w)
  }
  return out
}

function parseLocations(form: FormData): VousLocationKey[] {
  const raw = form.get("locations")
  if (typeof raw !== "string") return []
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  const seen = new Set<VousLocationKey>()
  for (const x of arr) if (typeof x === "string" && isVousLocationKey(x)) seen.add(x)
  return [...seen]
}

/** Email + first name for a set of member ids, for notifying participants. */
async function contactsFor(ids: string[]): Promise<Map<string, { email: string | null; firstName: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("members").select("id, email, first_name").in("id", ids)
  const map = new Map<string, { email: string | null; firstName: string }>()
  if (error) {
    console.log("[v0] vous contactsFor error:", error.message)
    return map
  }
  for (const row of (data ?? []) as { id: string; email: string | null; first_name: string }[]) {
    map.set(row.id, { email: row.email, firstName: row.first_name })
  }
  return map
}

function revalidateVous(id: string) {
  revalidatePath(`/vous/${id}`)
  revalidatePath("/", "layout")
}

function isParticipant(req: VousRequestRecord, memberId: string) {
  return req.inviter.id === memberId || req.invitee.id === memberId
}

/** Step 1–3: create a pending request and email the invitee. */
export async function requestVous(form: FormData): Promise<VousCreateResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const inviteeId = str(form, "inviteeId")
  if (!inviteeId) return { ok: false, error: "Please choose who you'd like to Vous with." }
  if (inviteeId === me.id) return { ok: false, error: "You can't request a Vous with yourself." }

  const invitee = await getMemberById(inviteeId)
  if (!invitee) return { ok: false, error: "We couldn't find that member. Please try again." }

  const windows = parseWindows(form)
  if ("error" in windows) return { ok: false, error: windows.error }

  const locations = parseLocations(form)
  if (locations.length === 0) return { ok: false, error: "Please choose at least one place you'd like to meet." }
  const locationOther = locations.includes("other") ? optional(form, "locationOther") : null

  const message = optional(form, "message")?.slice(0, MESSAGE_MAX) ?? null

  // Don't let two members stack up duplicate arrangements.
  const existing = await findExistingLiveVous(me.id, inviteeId)
  if (existing) {
    return {
      ok: false,
      existingId: existing.id,
      error:
        existing.status === "confirmed"
          ? "You already have a Vous booked with them. Open it from your dashboard."
          : "You already have a Vous in progress with them.",
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vous_requests")
    .insert({
      inviter_id: me.id,
      invitee_id: inviteeId,
      proposed_by: me.id,
      proposed_windows: windows,
      locations,
      location_other: locationOther,
      message,
      status: "pending",
    })
    .select("id")
    .single()

  if (error || !data) {
    console.log("[v0] requestVous insert error:", error?.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  const id = data.id as string

  if (invitee.email) {
    const origin = await getPublicOrigin()
    await sendVousRequestEmail({
      to: invitee.email,
      recipientFirstName: invitee.first_name,
      inviterName: memberName(me),
      message,
      viewUrl: `${origin}/vous/${id}`,
    })
  } else {
    console.log(`[v0] requestVous: invitee ${inviteeId} has no email; request created without notification.`)
  }

  revalidateVous(id)
  return { ok: true, id }
}

/** Step 5–7: the responder locks in a specific time + place. First one wins. */
export async function confirmVous(form: FormData): Promise<VousResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const id = str(form, "id")
  if (!id) return { ok: false, error: GENERIC_ERROR }

  const req = await getVousRequest(id)
  if (!req || !isParticipant(req, me.id)) return { ok: false, error: "We couldn't find that Vous request." }
  if (req.status === "confirmed") return { ok: false, error: "This Vous is already confirmed." }
  if (req.status === "cancelled") return { ok: false, error: "This Vous was cancelled." }
  if (req.status !== "pending" && req.status !== "counter_proposed") {
    return { ok: false, error: "This Vous is no longer open." }
  }
  if (req.proposedBy === me.id) {
    return { ok: false, error: "You proposed these times — it's the other member's turn to confirm." }
  }

  const window = req.windows[Number(str(form, "windowIndex"))]
  if (!window) return { ok: false, error: "Please choose one of the proposed times." }

  const startMin = timeToMinutes(str(form, "start"))
  const winStart = timeToMinutes(window.start)
  const winEnd = timeToMinutes(window.end)
  if (startMin === null || winStart === null || winEnd === null) return { ok: false, error: GENERIC_ERROR }
  if (startMin < winStart || startMin >= winEnd) {
    return { ok: false, error: "Please pick a start time inside the proposed window." }
  }

  const requested = Number(str(form, "duration"))
  const duration = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_DURATION
  const endMin = Math.min(startMin + duration, winEnd)
  if (endMin <= startMin) return { ok: false, error: "That meeting length doesn't fit the window." }

  const confirmedStart = minutesToTime(startMin)
  const confirmedEnd = minutesToTime(endMin)

  const locationKey = str(form, "location")
  if (!isVousLocationKey(locationKey) || !req.locations.includes(locationKey)) {
    return { ok: false, error: "Please choose one of the suggested places." }
  }
  const locationOther = locationKey === "other" ? req.locationOther : null

  const supabase = await createClient()
  // Conditional on the row still being open: if someone else confirmed or
  // cancelled between our read and now, this matches zero rows and we bail
  // rather than clobber their choice.
  const { data, error } = await supabase
    .from("vous_requests")
    .update({
      status: "confirmed",
      confirmed_date: window.date,
      confirmed_start: confirmedStart,
      confirmed_end: confirmedEnd,
      confirmed_location: locationKey,
      confirmed_location_other: locationOther,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "counter_proposed"])
    .select("id")
    .maybeSingle()

  if (error) {
    console.log("[v0] confirmVous update error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!data) return { ok: false, error: RACE_ERROR }

  await notifyConfirmed(req, window.date, confirmedStart, confirmedEnd, locationKey, locationOther)

  revalidateVous(id)
  return { ok: true }
}

/** Emails both members that the vous is booked, each with an add-to-calendar link. */
async function notifyConfirmed(
  req: VousRequestRecord,
  date: string,
  start: string,
  end: string,
  locationKey: VousLocationKey,
  locationOther: string | null,
) {
  const contacts = await contactsFor([req.inviter.id, req.invitee.id])
  const dateLabel = formatVousDate(date)
  const timeLabel = formatTimeRange(start, end)
  const locationLabel = confirmedLocationLabel(locationKey, req.inviter.firstName, req.invitee.firstName, locationOther)

  const startUtc = nyWallToUtc(date, start)
  const endUtc = nyWallToUtc(date, end)
  const origin = await getPublicOrigin()
  const calendarUrl =
    startUtc && endUtc
      ? googleCalendarUrl({
          title: `Vous: ${partyName(req.inviter)} + ${partyName(req.invitee)}`,
          details: "RED Group Vous arranged through incREDible.",
          location: locationLabel,
          startUtcISO: startUtc.toISOString(),
          endUtcISO: endUtc.toISOString(),
        })
      : `${origin}/vous/${req.id}`

  const inviter = contacts.get(req.inviter.id)
  const invitee = contacts.get(req.invitee.id)

  const sends: Promise<unknown>[] = []
  if (inviter?.email) {
    sends.push(
      sendVousConfirmedEmail({
        to: inviter.email,
        recipientFirstName: inviter.firstName,
        otherName: partyName(req.invitee),
        dateLabel,
        timeLabel,
        locationLabel,
        calendarUrl,
      }),
    )
  }
  if (invitee?.email) {
    sends.push(
      sendVousConfirmedEmail({
        to: invitee.email,
        recipientFirstName: invitee.firstName,
        otherName: partyName(req.inviter),
        dateLabel,
        timeLabel,
        locationLabel,
        calendarUrl,
      }),
    )
  }
  await Promise.allSettled(sends)
}

/** "None of these work" → the responder replaces the windows and volleys back. */
export async function counterProposeVous(form: FormData): Promise<VousResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const id = str(form, "id")
  if (!id) return { ok: false, error: GENERIC_ERROR }

  const req = await getVousRequest(id)
  if (!req || !isParticipant(req, me.id)) return { ok: false, error: "We couldn't find that Vous request." }
  if (req.status !== "pending" && req.status !== "counter_proposed") {
    return { ok: false, error: "This Vous is no longer open." }
  }
  if (req.proposedBy === me.id) {
    return { ok: false, error: "You already proposed these times — it's the other member's turn." }
  }

  const windows = parseWindows(form)
  if ("error" in windows) return { ok: false, error: windows.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vous_requests")
    .update({
      proposed_windows: windows,
      proposed_by: me.id,
      status: "counter_proposed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "counter_proposed"])
    .select("id")
    .maybeSingle()

  if (error) {
    console.log("[v0] counterProposeVous update error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!data) return { ok: false, error: RACE_ERROR }

  const otherParty = me.id === req.inviter.id ? req.invitee : req.inviter
  const contacts = await contactsFor([otherParty.id])
  const other = contacts.get(otherParty.id)
  if (other?.email) {
    const origin = await getPublicOrigin()
    await sendVousCounterEmail({
      to: other.email,
      recipientFirstName: other.firstName,
      counterName: memberName(me),
      viewUrl: `${origin}/vous/${id}`,
    })
  }

  revalidateVous(id)
  return { ok: true }
}

/** Either participant may cancel at any live stage; the other is emailed. */
export async function cancelVous(form: FormData): Promise<VousResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const id = str(form, "id")
  if (!id) return { ok: false, error: GENERIC_ERROR }

  const req = await getVousRequest(id)
  if (!req || !isParticipant(req, me.id)) return { ok: false, error: "We couldn't find that Vous request." }
  if (req.status === "cancelled") return { ok: false, error: "This Vous is already cancelled." }
  if (req.status === "expired") return { ok: false, error: "This Vous has expired." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vous_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: me.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "cancelled")
    .select("id")
    .maybeSingle()

  if (error) {
    console.log("[v0] cancelVous update error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!data) return { ok: false, error: "This Vous is already cancelled." }

  const otherParty = me.id === req.inviter.id ? req.invitee : req.inviter
  const contacts = await contactsFor([otherParty.id])
  const other = contacts.get(otherParty.id)
  if (other?.email) {
    const origin = await getPublicOrigin()
    await sendVousCancelledEmail({
      to: other.email,
      recipientFirstName: other.firstName,
      cancellerName: memberName(me),
      viewUrl: `${origin}/member/${me.id}`,
    })
  }

  revalidateVous(id)
  return { ok: true }
}
