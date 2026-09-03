"use server"

import { revalidatePath } from "next/cache"
import { getInviteHost, isValidInviteToken } from "@/lib/invite-link"
import { GUEST_MEETING_LIMIT, getMeetingOptions, type MeetingOption } from "@/lib/meeting-options"
import { createAdminClient } from "@/lib/supabase/admin"
import { SUB_GROUPS, memberName, type SubGroup } from "@/lib/types"

/**
 * Guest self-registration from a scanned QR code.
 *
 * This is the app's only unauthenticated write, so everything the row contains
 * is either validated here or re-derived from a trusted source. The client
 * sends a token, a meeting id and the guest's own contact details — nothing
 * else is believed.
 */

export type GuestRegisterResult =
  | { ok: true; hostName: string; meetingLabel: string; meetingId: string; alreadyRegistered: boolean }
  | { ok: false; error: string }

const GENERIC_ERROR = "Something went wrong saving your registration. Please try again."

/** Trims and caps a free-text field so a huge paste cannot bloat the row. */
function text(form: FormData, key: string, max: number): string {
  const raw = form.get(key)
  return typeof raw === "string" ? raw.trim().slice(0, max) : ""
}

export async function registerGuest(form: FormData): Promise<GuestRegisterResult> {
  const token = text(form, "token", 64)
  const meetingId = text(form, "meetingId", 400)
  const guestName = text(form, "guestName", 120)
  const guestEmail = text(form, "guestEmail", 200).toLowerCase()
  const guestCompany = text(form, "guestCompany", 160)

  // Shape-checked before any database work so a probing request costs nothing.
  if (!isValidInviteToken(token)) {
    return { ok: false, error: "This invitation link looks incomplete. Please scan the QR code again." }
  }

  if (guestName.length < 2) return { ok: false, error: "Please enter your name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return { ok: false, error: "Please enter a valid email address." }
  }

  // The token is what credits the member, so it is resolved server-side. The
  // browser never sends a member id — if it did, anyone could award guests to
  // any member they liked.
  const host = await getInviteHost(token)
  if (!host) {
    return { ok: false, error: "This invitation link is no longer valid. Please ask for a fresh QR code." }
  }

  // Meeting details come from the live calendar, never the form. Otherwise a
  // tampered POST could store any title or venue text it wanted, or file the
  // guest under a sub-group whose meeting they never picked.
  const meetings = await getMeetingOptions(GUEST_MEETING_LIMIT)
  const meeting: MeetingOption | undefined = meetings.find((m) => m.id === meetingId)

  if (!meeting) {
    return {
      ok: false,
      error: "That meeting is no longer on the calendar. Please pick another date from the list.",
    }
  }

  // A meeting title that maps to no sub-group (a one-off event, say) falls back
  // to the inviting member's own group, because sub_group is NOT NULL. Guessing
  // the host's group is right far more often than any fixed default.
  const subGroup: SubGroup = meeting.subGroup ?? host.sub_group
  if (!SUB_GROUPS.includes(subGroup)) return { ok: false, error: GENERIC_ERROR }

  // Service-role: `anon` has no insert policy on guest_invitations, and giving
  // it one would let anybody write arbitrary rows into the activity tally
  // straight from a browser console. Authorization for this write is the valid
  // token resolved above.
  let supabase
  try {
    supabase = createAdminClient()
  } catch (error) {
    console.error("registerGuest: admin client unavailable:", error instanceof Error ? error.message : error)
    return { ok: false, error: GENERIC_ERROR }
  }

  const { error } = await supabase.from("guest_invitations").insert({
    inviter_user_id: host.id,
    guest_name: guestName,
    guest_email: guestEmail,
    guest_company: guestCompany || null,
    sub_group: subGroup,
    meeting_uid: meeting.id,
    meeting_start: meeting.startISO,
    meeting_title: meeting.title,
    meeting_location: meeting.location,
    source: "guest_link",
  })

  const host_name = memberName(host)

  if (error) {
    // 23505 = unique_violation, i.e. this guest already registered for this
    // meeting (migration 011's dedupe index). A double-tap or a back-button
    // resubmit is completely normal on a public page with no login, so it is
    // reported as success — the guest IS registered, and telling them
    // otherwise would only make them try again.
    if (error.code === "23505") {
      return {
        ok: true,
        hostName: host_name,
        meetingLabel: meeting.label,
        meetingId: meeting.id,
        alreadyRegistered: true,
      }
    }

    console.error("registerGuest insert error:", error.message)
    return { ok: false, error: GENERIC_ERROR }
  }

  // The member's own tallies and the admin dashboard read this table, so their
  // cached pages have to be dropped or the new guest will not show up.
  revalidatePath("/", "layout")

  return {
    ok: true,
    hostName: host_name,
    meetingLabel: meeting.label,
    meetingId: meeting.id,
    alreadyRegistered: false,
  }
}
