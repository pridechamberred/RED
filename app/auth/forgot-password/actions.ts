"use server"

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPasswordResetEmail } from "@/lib/email"

/**
 * Always shaped the same way on success, whether or not the address belongs to
 * a member. Telling a stranger "no such account" would turn this form into a
 * membership checker for a group whose directory is otherwise private.
 */
type Result = { ok: true } | { ok: false; message: string }

/** Supabase recovery tokens are valid for an hour by default. */
const LINK_LIFETIME = "1 hour"

/** Minimum gap between reset emails for one address, in milliseconds. */
const THROTTLE_MS = 60_000

/**
 * Resolves this deployment's own origin from the incoming request.
 *
 * Deliberately NOT using NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL: that proxy
 * exists so links *Supabase itself* sends can reach the v0 sandbox. Here we
 * mint the token ourselves and put our own URL in the email, so Supabase never
 * does the redirecting and its allow-list is not involved at all.
 */
async function getOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function requestPasswordReset(email: string): Promise<Result> {
  const address = email.trim().toLowerCase()

  if (!address || !address.includes("@")) {
    return { ok: false, message: "Please enter the email address you sign in with." }
  }

  const admin = createAdminClient()

  // Look the member up first so we can address them by name, apply our own
  // throttle, and — importantly — distinguish "no such account" (stay silent)
  // from "email provider is broken" (must be reported).
  const { data: member, error: lookupError } = await admin
    .from("members")
    .select("first_name, email, auth_user_id")
    .ilike("email", address)
    .maybeSingle()

  if (lookupError) {
    console.log("[v0] password reset lookup failed:", lookupError.message)
    return { ok: false, message: "We couldn't process that just now. Please try again." }
  }

  // Unknown address, or a member who has no login yet. Report success anyway so
  // the response is indistinguishable from the real thing.
  if (!member?.auth_user_id) {
    console.log("[v0] password reset requested for an address with no login — no email sent.")
    return { ok: true }
  }

  const { data: authUser } = await admin.auth.admin.getUserById(member.auth_user_id)
  const lastRequested = authUser?.user?.user_metadata?.reset_requested_at

  if (typeof lastRequested === "string") {
    const elapsed = Date.now() - new Date(lastRequested).getTime()
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < THROTTLE_MS) {
      // Silently skip rather than erroring: someone who double-taps the button
      // should not see a scary message, and this stops the form being used to
      // mail-bomb a member.
      console.log("[v0] password reset throttled for", address)
      return { ok: true }
    }
  }

  // generateLink mints a recovery token WITHOUT emailing anything itself, which
  // is what lets us deliver it through Resend instead of Supabase's mailer.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authUser?.user?.email ?? member.email,
  })

  if (linkError || !link?.properties?.hashed_token) {
    console.log("[v0] generateLink(recovery) failed:", linkError?.message ?? "no token returned")
    return { ok: false, message: "We couldn't send that email just now. Please try again." }
  }

  const origin = await getOrigin()
  const callback = new URL(`${origin}/auth/callback`)
  callback.searchParams.set("token_hash", link.properties.hashed_token)
  callback.searchParams.set("type", "recovery")
  // The callback verifies the token, signs them in, then hands off to the
  // existing password screen. `reason` only tweaks the wording there.
  callback.searchParams.set("next", "/auth/set-password?reason=recovery")

  const { sent } = await sendPasswordResetEmail({
    to: member.email,
    recipientFirstName: member.first_name,
    resetUrl: callback.toString(),
    expiresIn: LINK_LIFETIME,
  })

  if (!sent) {
    // Never claim an email is on its way when it is not — that is what leaves
    // someone stuck waiting for a message that will never arrive.
    return { ok: false, message: "We couldn't send that email just now. Please try again, or ask an admin for help." }
  }

  // Stamped only after a successful send, so a failed attempt does not lock the
  // member out of retrying for a minute.
  await admin.auth.admin.updateUserById(member.auth_user_id, {
    user_metadata: { ...(authUser?.user?.user_metadata ?? {}), reset_requested_at: new Date().toISOString() },
  })

  return { ok: true }
}
