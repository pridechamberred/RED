"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ContactState = {
  status: "idle" | "saved" | "error"
  message?: string
  phoneError?: string
  phone: string
  share: boolean
}

function normalizePhone(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return { ok: true, value: null }
  if (!/^[+0-9 ().\-]+$/.test(trimmed)) {
    return { ok: false, error: "Use digits, spaces, +, -, ( ) only." }
  }
  const digits = trimmed.replace(/\D/g, "").length
  if (digits < 7 || digits > 15 || trimmed.length > 30) {
    return { ok: false, error: "That doesn't look like a full phone number." }
  }
  return { ok: true, value: trimmed }
}

export async function saveContact(prev: ContactState, formData: FormData): Promise<ContactState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...prev, status: "error", message: "Please sign in again." }

  const rawPhone = String(formData.get("phone") ?? "").slice(0, 60)
  const share = formData.get("share_contact") === "yes"

  const phone = normalizePhone(rawPhone)
  if (!phone.ok) {
    return { status: "error", message: "Please fix your phone number.", phoneError: phone.error, phone: rawPhone, share }
  }

  // RLS (members_update_own) restricts this to the caller's own row.
  const { error } = await supabase
    .from("members")
    .update({ phone: phone.value, share_contact: share })
    .eq("auth_user_id", user.id)

  if (error) {
    console.log("[v0] saveContact update error:", error.message)
    const missingColumns = /phone|share_contact/i.test(error.message) || error.code === "PGRST204"
    return {
      status: "error",
      message: missingColumns
        ? "Contact details aren't switched on yet. An admin needs to run migration 020."
        : "We couldn't save your details. Please try again.",
      phone: rawPhone,
      share,
    }
  }

  revalidatePath("/profile")
  revalidatePath("/member", "layout")
  return {
    status: "saved",
    message: share
      ? "Saved. Other members can now see your phone number and email."
      : "Saved. Your phone number and email are hidden from other members.",
    phone: phone.value ?? "",
    share,
  }
}
