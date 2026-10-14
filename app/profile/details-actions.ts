"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type DetailsState = {
  status: "idle" | "saved" | "error"
  message?: string
  companyError?: string
  emailError?: string
  company: string
  email: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Saves the member's business name and email. The email is also their login,
 * so it is changed on the auth account and the members row together (via the
 * service role); if the second write fails the first is rolled back.
 */
export async function saveDetails(prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...prev, status: "error", message: "Please sign in again." }

  const company = String(formData.get("company") ?? "").trim().replace(/\s+/g, " ")
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const values = { company, email }

  if (company.length > 120) {
    return { ...values, status: "error", message: "Please fix the highlighted field.", companyError: "Keep it under 120 characters." }
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ...values, status: "error", message: "Please fix the highlighted field.", emailError: "Enter a valid email address." }
  }

  const admin = createAdminClient()
  const { data: me, error: meError } = await admin
    .from("members")
    .select("id, email")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (meError || !me) {
    return { ...values, status: "error", message: "We couldn't find your profile. Please try again." }
  }

  const previousEmail = (me.email ?? user.email ?? "").toLowerCase()
  const emailChanged = email !== previousEmail

  if (emailChanged) {
    const { data: taken } = await admin
      .from("members")
      .select("id")
      .ilike("email", email)
      .neq("id", me.id)
      .limit(1)
      .maybeSingle()
    if (taken) {
      return { ...values, status: "error", message: "Please fix the highlighted field.", emailError: "Another member already uses that email." }
    }

    const { error: authError } = await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true })
    if (authError) {
      console.error("saveDetails auth email update error:", authError.message)
      const inUse = /already|registered|exists/i.test(authError.message)
      return {
        ...values,
        status: "error",
        message: "Please fix the highlighted field.",
        emailError: inUse ? "That email is already linked to another login." : "We couldn't change your email. Please try again.",
      }
    }
  }

  const { error } = await admin
    .from("members")
    .update({ company: company || null, email })
    .eq("id", me.id)

  if (error) {
    console.error("saveDetails members update error:", error.message)
    if (emailChanged && previousEmail) {
      await admin.auth.admin.updateUserById(user.id, { email: previousEmail, email_confirm: true })
    }
    return { ...values, status: "error", message: "We couldn't save your details. Please try again." }
  }

  revalidatePath("/profile")
  revalidatePath("/member", "layout")
  revalidatePath("/admin", "layout")
  return {
    status: "saved",
    message: emailChanged ? "Saved. Use your new email address next time you sign in." : "Saved.",
    company,
    email,
  }
}
