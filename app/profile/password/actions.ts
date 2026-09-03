"use server"

import { createClient as createPlainClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { isPasswordValid, PASSWORD_MIN_LENGTH } from "@/lib/password-policy"

type Result = { ok: true } | { ok: false; message: string }

/**
 * Changes the password of a member who still knows their current one.
 *
 * Requires the current password even though the session alone would let
 * Supabase update it: without that check, anyone who got hold of an unlocked
 * phone could lock the real member out of their own account.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<Result> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, message: "Your session has expired. Please sign in again." }
  }

  if (!isPasswordValid(newPassword)) {
    return {
      ok: false,
      message: `Your new password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, a number and a special character.`,
    }
  }

  if (currentPassword === newPassword) {
    return { ok: false, message: "That is already your current password. Please choose a different one." }
  }

  // Verified on a throwaway client with persistSession off, so a wrong guess
  // cannot disturb the cookies of the session we are already holding.
  const verifier = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (verifyError) {
    if (verifyError.status === 429) {
      return { ok: false, message: "Too many attempts. Please wait a moment and try again." }
    }
    return { ok: false, message: "That current password isn't right." }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false, password_set_at: new Date().toISOString() },
  })

  if (error) {
    if (error.message.toLowerCase().includes("should be different")) {
      return { ok: false, message: "That is already your current password. Please choose a different one." }
    }
    console.log("[v0] change password failed:", error.message)
    return { ok: false, message: "We couldn't update your password. Please try again." }
  }

  return { ok: true }
}
