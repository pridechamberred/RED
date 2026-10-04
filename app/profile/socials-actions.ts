"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { SOCIAL_PLATFORMS, normalizeSocial, type SocialColumn, type SocialKey } from "@/lib/socials"

export type SocialsState = {
  status: "idle" | "saved" | "error"
  message?: string
  fieldErrors?: Partial<Record<SocialKey, string>>
  values?: Partial<Record<SocialKey, string>>
}

export async function saveSocials(_prev: SocialsState, formData: FormData): Promise<SocialsState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "error", message: "Please sign in again." }

  const update: Partial<Record<SocialColumn, string | null>> = {}
  const fieldErrors: Partial<Record<SocialKey, string>> = {}
  const values: Partial<Record<SocialKey, string>> = {}

  for (const platform of SOCIAL_PLATFORMS) {
    const raw = String(formData.get(platform.key) ?? "").slice(0, 300)
    values[platform.key] = raw
    const result = normalizeSocial(platform, raw)
    if (result.ok) {
      update[platform.column] = result.value
      values[platform.key] = result.value ?? ""
    } else {
      fieldErrors[platform.key] = result.error
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted links.", fieldErrors, values }
  }

  // RLS (members_update_own) restricts this to the caller's own row.
  const { error } = await supabase.from("members").update(update).eq("auth_user_id", user.id)
  if (error) {
    console.log("[v0] saveSocials update error:", error.message)
    const missingColumns = /column .*social_/i.test(error.message) || error.code === "PGRST204"
    return {
      status: "error",
      message: missingColumns
        ? "Social links aren't switched on yet. An admin needs to run migration 018."
        : "We couldn't save your links. Please try again.",
      values,
    }
  }

  revalidatePath("/profile")
  revalidatePath("/member", "layout")
  return { status: "saved", message: "Your social links are saved.", values }
}
