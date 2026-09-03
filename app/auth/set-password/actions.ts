"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { RECOVERY_COOKIE } from "@/lib/auth-recovery"
import { isPasswordValid, PASSWORD_MIN_LENGTH } from "@/lib/password-policy"
import { TEMPORARY_PASSWORD } from "@/lib/temporary-password"

type Result = { ok: true } | { ok: false; message: string }

/**
 * Sets the signed-in member's own password and clears the first-time flag.
 *
 * Runs on the server so the rules are actually enforced: a client-only check
 * could be bypassed by calling supabase.auth.updateUser() directly from the
 * console, which would leave the member on the shared password while the app
 * believed they had chosen their own.
 */
export async function setOwnPassword(newPassword: string): Promise<Result> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: "Your session has expired. Please sign in again." }
  }

  if (!isPasswordValid(newPassword)) {
    return {
      ok: false,
      message: `Your password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, a number and a special character.`,
    }
  }

  if (newPassword.trim() === TEMPORARY_PASSWORD) {
    return {
      ok: false,
      message: "Please choose a password that is different from the temporary one you were given.",
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false, password_set_at: new Date().toISOString() },
  })

  if (error) {
    // Supabase rejects reusing the current password outright; surface that
    // plainly because it is the one failure the member can act on.
    if (error.message.toLowerCase().includes("should be different")) {
      return { ok: false, message: "That is already your current password. Please choose a new one." }
    }
    console.error("set-password failed:", error.message)
    return { ok: false, message: "We couldn't update your password. Please try again." }
  }

  // Must be cleared or the proxy keeps funnelling them back to this screen
  // even though they have just chosen a password.
  ;(await cookies()).delete(RECOVERY_COOKIE)

  return { ok: true }
}
