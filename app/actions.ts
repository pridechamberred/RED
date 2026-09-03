"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { RECOVERY_COOKIE } from "@/lib/auth-recovery"
import { getCurrentMember } from "@/lib/data"
import {
  sendOfflineReferralEmail,
  sendReferralEmail,
  sendReferredPersonEmail,
  sendVousLoggedEmail,
} from "@/lib/email"
import {
  formatMoney,
  isAdmin,
  memberName,
  REFERRAL_SOURCES,
  SUB_GROUPS,
  type ReferralSource,
  type SubGroup,
} from "@/lib/types"
import { getMeetingOptions, type MeetingOption } from "@/lib/meeting-options"
import { findRegisterMeeting } from "@/lib/attendance"
import { NO_MEETING } from "@/lib/meeting-constants"

export type ActionResult = { ok: true; note?: string } | { ok: false; error: string }

const GENERIC_ERROR = "We couldn't save that. Please try again."

/**
 * This deployment's own origin, for links inside emails.
 *
 * Same approach as the password-reset action: read it off the incoming request
 * rather than hardcoding a domain, so preview deployments link to themselves
 * instead of sending testers to production.
 */
async function getOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/** Matches the length check on public.done_deal_notes.note. */
const DEAL_NOTE_MAX = 500

function str(form: FormData, key: string) {
  const v = form.get(key)
  return typeof v === "string" ? v.trim() : ""
}

function optional(form: FormData, key: string) {
  const v = str(form, key)
  return v.length > 0 ? v : null
}

function positiveNumber(raw: string) {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function nonNegativeNumber(raw: string) {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

/** Guards against a member recording activity dated in the future. */
function dateWithinRange(value: string) {
  if (!isIsoDate(value)) return false
  const d = new Date(`${value}T00:00:00`)
  const tomorrow = new Date()
  tomorrow.setHours(23, 59, 59, 999)
  return d.getTime() <= tomorrow.getTime()
}

function revalidateActivity() {
  revalidatePath("/", "layout")
}

/**
 * Validates the "This deal followed a referral from:" answer into the two
 * columns it is stored as.
 *
 * The two halves have to agree — a named member only for the `member` source,
 * and never for the other three — because that pairing is a CHECK constraint
 * (see migration 008), so a mismatch would fail the insert with a generic
 * error instead of something the member can act on.
 *
 * Required for new deals, even though the columns are nullable: null is
 * reserved for rows that predate the field and must not be reachable from the
 * form.
 */
async function resolveReferralSource(
  form: FormData,
  currentMemberId: string,
): Promise<{ source: ReferralSource; memberId: string | null } | { error: string }> {
  const raw = str(form, "referralSource")
  const memberId = optional(form, "referralFromMemberId")

  if (!raw) return { error: "Please choose who this deal followed a referral from." }
  if (!REFERRAL_SOURCES.includes(raw as ReferralSource)) return { error: GENERIC_ERROR }

  const source = raw as ReferralSource

  if (source !== "member") {
    // Ignore any id sent alongside a non-member source rather than erroring:
    // the constraint requires it to be null, and the member's actual answer is
    // unambiguous.
    return { source, memberId: null }
  }

  if (!memberId) return { error: "Please choose which RED member referred this deal." }
  if (memberId === currentMemberId) return { error: "You can't record a referral from yourself." }

  // Confirm the member exists before relying on the FK, so a stale dropdown
  // (someone removed since the page loaded) reads as a real message rather than
  // a foreign key violation.
  const supabase = await createClient()
  const { data, error } = await supabase.from("members").select("id").eq("id", memberId).maybeSingle()

  if (error) {
    console.log("[v0] resolveReferralSource error:", error.message)
    return { error: GENERIC_ERROR }
  }
  if (!data) return { error: "We couldn't find that member. Please choose again." }

  return { source, memberId }
}

export async function recordVous(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const memberId = str(form, "memberId")
  const date = str(form, "date")
  const notes = optional(form, "notes")

  if (!memberId) return { ok: false, error: "Please choose who you met." }
  if (memberId === me.id) return { ok: false, error: "You can't record a vous with yourself." }
  if (!dateWithinRange(date)) return { ok: false, error: "Please choose a valid date, today or earlier." }

  const supabase = await createClient()
  const { error } = await supabase.from("vous").insert({
    user_id: me.id,
    member_id: memberId,
    date,
    notes,
  })

  if (error) {
    console.log("[v0] recordVous error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()

  // A vous is mutual but logged one-sidedly, so only the person who remembered
  // gets the credit. Nudge the other member to log their side.
  //
  // Read after the insert, not before: the vous is what matters and it is
  // already saved, so nothing here may turn a successful record into an error.
  const { data: other } = await supabase
    .from("members")
    .select("first_name, email")
    .eq("id", memberId)
    .maybeSingle()

  let notified = true
  if (other?.email) {
    // Straight at the prefilled form, so a member who is already signed in on
    // their phone lands on it directly. If they are signed out the proxy sends
    // them to login carrying this path in `next` and returns them here after.
    const origin = await getOrigin()
    const { sent } = await sendVousLoggedEmail({
      to: other.email,
      recipientFirstName: other.first_name,
      loggerName: memberName(me),
      vousDate: date,
      logItUrl: `${origin}/record/vous?member=${me.id}`,
    })
    notified = sent
  } else {
    console.log(`[v0] recordVous: no email on member ${memberId}, nudge not sent.`)
  }

  return {
    ok: true,
    note: notified ? undefined : "Vous recorded, but we couldn't email them about it.",
  }
}

export async function recordReferral(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const recipientId = str(form, "memberId")
  const referredName = str(form, "referredName")

  // An offline referral already happened elsewhere, so it carries a name and a
  // date and nothing else. Anything the form may still have posted for the
  // other fields is dropped rather than trusted: the mode decides what is
  // stored, not whichever inputs happened to be in the DOM.
  const isOffline = str(form, "referralMode") === "offline"

  const referredEmail = isOffline ? null : optional(form, "referredEmail")
  const referredPhone = isOffline ? null : optional(form, "referredPhone")
  const referredCompany = isOffline ? null : optional(form, "referredCompany")
  const details = isOffline ? null : str(form, "details")

  if (!recipientId) return { ok: false, error: "Please choose who you're referring to." }
  if (recipientId === me.id) return { ok: false, error: "You can't refer someone to yourself." }
  if (!referredName) return { ok: false, error: "Please enter the referred person's name." }

  // The email is optional now, but a supplied one still has to be usable —
  // otherwise the notify option below would silently target a dead address.
  if (referredEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referredEmail)) {
    return { ok: false, error: "Please enter a valid email address for the referred person." }
  }

  // Only a new referral needs details: an offline one is a record of something
  // the recipient already knows about.
  if (!isOffline && !details) return { ok: false, error: "Please add some referral details." }

  // Notifying the referred person requires an address to notify. Guarded here
  // as well as in the form, since a client can post anything.
  const notifyReferred = !isOffline && Boolean(referredEmail) && str(form, "notifyReferred") === "yes"

  // Offline only: when it actually happened. Blank means today.
  const occurredOnRaw = isOffline ? optional(form, "occurredOn") : null
  if (occurredOnRaw && !dateWithinRange(occurredOnRaw)) {
    return { ok: false, error: "Please choose a date that isn't in the future." }
  }
  const occurredOn = occurredOnRaw ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()

  // Fetch the recipient's email server-side; it is never exposed to the client.
  const { data: recipient, error: recipientError } = await supabase
    .from("members")
    // company is needed for the introduction email to the referred person.
    .select("id, first_name, last_name, email, company")
    .eq("id", recipientId)
    .maybeSingle()

  if (recipientError || !recipient) {
    console.log("[v0] recordReferral recipient lookup failed:", recipientError?.message)
    return { ok: false, error: "We couldn't find that member. Please try again." }
  }

  const { error } = await supabase.from("referrals").insert({
    referrer_user_id: me.id,
    recipient_member_id: recipientId,
    referred_name: referredName,
    referred_email: referredEmail,
    referred_phone: referredPhone,
    referred_company: referredCompany,
    details,
    referral_mode: isOffline ? "offline" : "new",
    occurred_on: occurredOn,
    notify_referred: notifyReferred,
  })

  if (error) {
    console.log("[v0] recordReferral error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  // The recipient hears about it either way, but the two emails say very
  // different things: one passes on details, the other confirms a record of a
  // conversation they were already part of.
  const { sent } = isOffline
    ? await sendOfflineReferralEmail({
        to: recipient.email,
        recipientFirstName: recipient.first_name,
        referrerName: memberName(me),
        referredName,
        occurredOn,
      })
    : await sendReferralEmail({
        to: recipient.email,
        recipientFirstName: recipient.first_name,
        referrerName: memberName(me),
        referrerCompany: me.company,
        referredName,
        referredEmail,
        referredPhone,
        referredCompany,
        details: details ?? "",
      })

  // Only when the referrer explicitly opted in, and only ever to an address
  // they supplied. Signed off by the referrer's sub-group, since the referrer
  // is this person's only actual connection to the chamber.
  let introSent = true
  if (notifyReferred && referredEmail) {
    const intro = await sendReferredPersonEmail({
      to: referredEmail,
      referredName,
      referrerName: memberName(me),
      referrerSubGroup: me.sub_group,
      recipientName: memberName(recipient),
      recipientCompany: recipient.company,
    })
    introSent = intro.sent
  }

  revalidateActivity()

  // Two independent emails, so the note has to distinguish them: the member
  // needs to know which one to follow up by hand.
  const failures: string[] = []
  if (!sent) failures.push(`we couldn't email ${recipient.first_name}`)
  if (!introSent) failures.push(`we couldn't email ${referredName}`)

  return {
    ok: true,
    note: failures.length
      ? `Referral saved, but ${failures.join(" and ")} — please let them know directly.`
      : undefined,
  }
}

export async function recordDoneDeal(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const dealType = str(form, "dealType")
  const date = str(form, "date")
  const dealNote = optional(form, "notes")

  const referral = await resolveReferralSource(form, me.id)
  if ("error" in referral) return { ok: false, error: referral.error }

  if (dealNote !== null && dealNote.length > DEAL_NOTE_MAX) {
    return { ok: false, error: `Please keep the note to ${DEAL_NOTE_MAX} characters or fewer.` }
  }
  if (dealType !== "one-off" && dealType !== "recurring") {
    return { ok: false, error: "Please choose whether this is one-off or recurring." }
  }
  if (!dateWithinRange(date)) return { ok: false, error: "Please choose a valid date, today or earlier." }

  // One-off deals store a fixed value. Recurring deals store only what they
  // bill each period — their total is accrued from the date onwards.
  let dealValue: number | null = null
  let recurringValue: number | null = null
  let recurringFrequency: string | null = null

  if (dealType === "one-off") {
    dealValue = positiveNumber(str(form, "dealValue"))
    if (dealValue === null) return { ok: false, error: "Please enter a deal value greater than zero." }
    if (dealValue > 100_000_000) return { ok: false, error: "That deal value looks too large — please check it." }
  } else {
    recurringValue = positiveNumber(str(form, "recurringValue"))
    recurringFrequency = str(form, "recurringFrequency")
    if (recurringValue === null) return { ok: false, error: "Please enter the recurring amount." }
    if (recurringValue > 100_000_000) return { ok: false, error: "That recurring amount looks too large." }
    if (!["week", "month", "quarter", "year"].includes(recurringFrequency)) {
      return { ok: false, error: "Please choose how often the amount recurs." }
    }
  }

  const supabase = await createClient()
  // `select` so we get the new id back — the private note is stored against it
  // in a separate table, so there is nothing to attach it to otherwise.
  const { data: inserted, error } = await supabase
    .from("done_deals")
    .insert({
      user_id: me.id,
      deal_value: dealValue,
      deal_type: dealType,
      recurring_value: recurringValue,
      recurring_frequency: recurringFrequency,
      referral_source: referral.source,
      referral_from_member_id: referral.memberId,
      date,
    })
    .select("id")
    .single()

  if (error || !inserted) {
    console.log("[v0] recordDoneDeal error:", error?.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()

  if (dealNote === null) return { ok: true }

  // The deal itself is already saved, so a failed note must not read as a
  // failed submission — the member would add the deal twice. Report it as a
  // warning instead and point them at Update, which can set the note on its
  // own. (This is also what a pending migration 006 looks like.)
  const { error: noteError } = await supabase.from("done_deal_notes").insert({
    deal_id: inserted.id,
    user_id: me.id,
    note: dealNote,
  })

  if (noteError) {
    console.log("[v0] recordDoneDeal note error:", noteError.message)
    return { ok: true, note: "The deal was added, but we couldn't save your note. Use Update to add it again." }
  }

  return { ok: true }
}

/**
 * Amend an existing done deal from the record.
 *
 * Five intents, all scoped to the caller's own deals:
 *   override  — replace the computed total for one year with a manual figure
 *   clear     — drop that override and go back to accrual
 *   stop      — halt a recurring deal permanently, locking what it accrued
 *   notes     — set or remove the member's own private note for the deal
 *   referral  — change who the deal followed a referral from
 */
export async function updateDoneDeal(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const dealId = str(form, "dealId")
  const intent = str(form, "intent")
  if (!dealId) return { ok: false, error: GENERIC_ERROR }

  const supabase = await createClient()

  // Read the deal first so we can validate against what it actually is, and so
  // a member cannot amend someone else's row even if RLS were relaxed.
  const { data: existing, error: readError } = await supabase
    .from("done_deals")
    .select("id, date, deal_type, user_id")
    .eq("id", dealId)
    .eq("user_id", me.id)
    .maybeSingle()

  if (readError) {
    console.log("[v0] updateDoneDeal read error:", readError.message)
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!existing) return { ok: false, error: "We couldn't find that deal on your record." }

  const deal = existing as { id: string; date: string; deal_type: "one-off" | "recurring" }

  // Notes are handled on their own because they live in a different table
  // (public.done_deal_notes, owner-only by RLS) and so never form part of the
  // done_deals patch built below.
  if (intent === "notes") {
    const dealNote = optional(form, "notes")

    if (dealNote !== null && dealNote.length > DEAL_NOTE_MAX) {
      return { ok: false, error: `Please keep the note to ${DEAL_NOTE_MAX} characters or fewer.` }
    }

    // Clearing the box removes the note outright rather than storing an empty
    // string, so "no note" is one state in the database, not two.
    const { error: noteError } = dealNote === null
      ? await supabase.from("done_deal_notes").delete().eq("deal_id", deal.id).eq("user_id", me.id)
      : await supabase
          .from("done_deal_notes")
          .upsert(
            { deal_id: deal.id, user_id: me.id, note: dealNote, updated_at: new Date().toISOString() },
            { onConflict: "deal_id" },
          )

    if (noteError) {
      console.log("[v0] updateDoneDeal note error:", noteError.message)
      return { ok: false, error: GENERIC_ERROR }
    }

    revalidateActivity()
    return { ok: true, note: dealNote === null ? "Note removed." : "Note saved. Only you can see it." }
  }

  let patch: Record<string, unknown>
  let note: string

  if (intent === "override") {
    const total = nonNegativeNumber(str(form, "totalOverride"))
    if (total === null) return { ok: false, error: "Please enter a total of zero or more." }
    if (total > 100_000_000) return { ok: false, error: "That total looks too large — please check it." }

    const year = Number(str(form, "year"))
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: GENERIC_ERROR }

    patch = { total_override: total, total_override_year: year }
    note = `Total for ${year} set to ${formatMoney(total)}.`
  } else if (intent === "clear") {
    patch = { total_override: null, total_override_year: null }
    note = "Override removed — the total is being calculated again."
  } else if (intent === "referral") {
    const referral = await resolveReferralSource(form, me.id)
    if ("error" in referral) return { ok: false, error: referral.error }

    patch = { referral_source: referral.source, referral_from_member_id: referral.memberId }
    note = "Referral source saved."
  } else if (intent === "stop") {
    if (deal.deal_type !== "recurring") return { ok: false, error: "Only recurring deals can be stopped." }

    const endedOn = str(form, "endedOn")
    if (!dateWithinRange(endedOn)) return { ok: false, error: "Please choose a stop date, today or earlier." }
    if (endedOn < deal.date) return { ok: false, error: "The stop date can't be before the deal started." }

    patch = { recurring_ended_on: endedOn }
    note = "Recurring deal stopped. Its total is now locked and won't resume."
  } else {
    return { ok: false, error: GENERIC_ERROR }
  }

  const { error } = await supabase.from("done_deals").update(patch).eq("id", dealId).eq("user_id", me.id)

  if (error) {
    console.log("[v0] updateDoneDeal error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()
  return { ok: true, note }
}

export async function recordVolunteering(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const date = str(form, "date")
  const organization = str(form, "organization")
  const hours = positiveNumber(str(form, "hours"))
  const notes = optional(form, "notes")

  if (!dateWithinRange(date)) return { ok: false, error: "Please choose a valid date, today or earlier." }
  if (!organization) return { ok: false, error: "Please enter the organization or event." }
  if (hours === null) return { ok: false, error: "Please enter the hours volunteered." }
  if (hours > 24) return { ok: false, error: "Hours must be 24 or fewer for a single day." }

  const supabase = await createClient()
  const { error } = await supabase.from("volunteering").insert({
    user_id: me.id,
    date,
    organization,
    hours,
    notes,
  })

  if (error) {
    console.log("[v0] recordVolunteering error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()
  return { ok: true }
}

export async function recordChamberEvent(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const eventName = str(form, "eventName")
  const date = str(form, "date")
  const notes = optional(form, "notes")

  if (!eventName) return { ok: false, error: "Please enter the event name." }
  if (!dateWithinRange(date)) return { ok: false, error: "Please choose a valid date, today or earlier." }

  // Hours are no longer collected for chamber events. The column is nullable and
  // is left out of the insert so it defaults to null; existing rows that already
  // have a value keep it and still render in the activity list.
  const supabase = await createClient()
  const { error } = await supabase.from("chamber_events").insert({
    user_id: me.id,
    date,
    event_name: eventName,
    notes,
  })

  if (error) {
    console.log("[v0] recordChamberEvent error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()
  return { ok: true }
}

export async function inviteGuest(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const guestName = str(form, "guestName")
  const guestEmail = str(form, "guestEmail")
  const meetingId = str(form, "meetingId")

  if (!guestName) return { ok: false, error: "Please enter the guest's name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return { ok: false, error: "Please enter a valid email address for your guest." }
  }

  // The meeting's group, title and venue are looked up here rather than read
  // from the form. The client only sends an id, so a tampered POST cannot file a
  // guest under a group whose meeting they weren't invited to, nor store
  // arbitrary text as the venue.
  let meeting: MeetingOption | null = null
  if (meetingId && meetingId !== NO_MEETING) {
    const options = await getMeetingOptions()
    meeting = options.find((o) => o.id === meetingId) ?? null
    if (!meeting) {
      return {
        ok: false,
        error: "That meeting is no longer listed. Please pick another from the list.",
      }
    }
  }

  // With a meeting chosen the group comes from the meeting; otherwise the member
  // picks it themselves. sub_group is NOT NULL, so there is always one.
  const subGroup = meeting?.subGroup ?? str(form, "subGroup")

  if (!SUB_GROUPS.includes(subGroup as SubGroup)) {
    return { ok: false, error: "Please choose which group they'll attend." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("guest_invitations").insert({
    inviter_user_id: me.id,
    guest_name: guestName,
    guest_email: guestEmail,
    sub_group: subGroup,
    meeting_uid: meeting?.id ?? null,
    meeting_start: meeting?.startISO ?? null,
    meeting_title: meeting?.title ?? null,
    meeting_location: meeting?.location ?? null,
  })

  if (error) {
    console.error("inviteGuest error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()
  return {
    ok: true,
    note: meeting
      ? `${guestName} is saved as a guest for ${meeting.label}. Email invitations aren't switched on yet, so please let them know directly for now.`
      : `${guestName} is saved as a guest for ${subGroup}. No meeting date is set yet, and email invitations aren't switched on, so please let them know directly for now.`,
  }
}

/**
 * Records (or clears) one person's attendance at one meeting.
 *
 * The client sends only a meeting id, who the row is about, and the new value.
 * Everything trust-bearing — the meeting's sub-group, title and start, and
 * whether the caller may touch that sub-group at all — is re-derived here.
 */
export async function setAttendance(form: FormData): Promise<ActionResult> {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) return { ok: false, error: "Only admins can record attendance." }

  const meetingId = str(form, "meetingId")
  const subjectKind = str(form, "subjectKind")
  const subjectId = str(form, "subjectId")
  const value = str(form, "value")

  if (subjectKind !== "member" && subjectKind !== "guest") {
    return { ok: false, error: GENERIC_ERROR }
  }
  if (value !== "attended" && value !== "absent" && value !== "substitute" && value !== "clear") {
    return { ok: false, error: GENERIC_ERROR }
  }
  // "Substitute" is a members-only concept — a one-off visitor either turned up
  // or didn't. Enforced here as well as hidden in the UI, so a tampered request
  // can't put a guest into a state the product doesn't define.
  if (value === "substitute" && subjectKind !== "member") {
    return { ok: false, error: GENERIC_ERROR }
  }

  // Validates the id is a real meeting still inside the register window, and
  // recovers its group/title/start from the calendar rather than the form.
  const meeting = await findRegisterMeeting(meetingId)
  if (!meeting) {
    return { ok: false, error: "That meeting is no longer open for attendance." }
  }
  if (!meeting.subGroup) {
    return { ok: false, error: "This meeting isn't linked to a sub-group, so attendance can't be recorded." }
  }

  // A sub-group admin is confined to their own group; super-admins are not.
  if (me.role === "admin" && me.sub_group !== meeting.subGroup) {
    return { ok: false, error: "You can only record attendance for your own sub-group." }
  }

  const supabase = await createClient()

  // Confirm the subject really belongs on this register, so a tampered id can't
  // attach a stranger — or another group's member — to the meeting.
  if (subjectKind === "member") {
    const { data } = await supabase.from("members").select("sub_group").eq("id", subjectId).maybeSingle()
    if (!data || (data as { sub_group: SubGroup }).sub_group !== meeting.subGroup) {
      return { ok: false, error: GENERIC_ERROR }
    }
  } else {
    const { data } = await supabase
      .from("guest_invitations")
      .select("meeting_uid")
      .eq("id", subjectId)
      .maybeSingle()
    if (!data || (data as { meeting_uid: string | null }).meeting_uid !== meeting.id) {
      return { ok: false, error: GENERIC_ERROR }
    }
  }

  const subjectColumn = subjectKind === "member" ? "member_id" : "guest_invitation_id"

  if (value === "clear") {
    const { error } = await supabase
      .from("meeting_attendance")
      .delete()
      .eq("meeting_uid", meeting.id)
      .eq(subjectColumn, subjectId)

    if (error) {
      console.error("setAttendance clear error:", error.message)
      return { ok: false, error: GENERIC_ERROR }
    }

    revalidateActivity()
    return { ok: true }
  }

  // `value` is one of the three statuses at this point — "clear" returned above.
  const status = value

  // Explicit find-then-write rather than an upsert: `subject_key` is a generated
  // column, and ON CONFLICT inference over it is not worth relying on.
  const { data: existing } = await supabase
    .from("meeting_attendance")
    .select("id")
    .eq("meeting_uid", meeting.id)
    .eq(subjectColumn, subjectId)
    .maybeSingle()

  const error = existing
    ? (
        await supabase
          .from("meeting_attendance")
          .update({ status, recorded_by: me.id })
          .eq("id", (existing as { id: string }).id)
      ).error
    : (
        await supabase.from("meeting_attendance").insert({
          meeting_uid: meeting.id,
          meeting_start: meeting.startISO,
          meeting_title: meeting.title,
          sub_group: meeting.subGroup,
          [subjectColumn]: subjectId,
          status,
          recorded_by: me.id,
        })
      ).error

  if (error) {
    console.error("setAttendance error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  revalidateActivity()
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Dropped alongside the session, so abandoning a password reset does not
  // leave a stale flag that funnels the next sign-in to the password screen.
  ;(await cookies()).delete(RECOVERY_COOKIE)
  redirect("/auth/login")
}
