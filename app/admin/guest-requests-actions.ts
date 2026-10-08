"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember, type GuestRequestDecision } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin, resolveSubGroups, type SubGroup } from "@/lib/types"

export type GuestRequestResult = { ok: true } | { ok: false; error: string }

const DECISIONS: GuestRequestDecision[] = ["approved", "denied"]

export async function setGuestRequestDecision(
  id: string,
  decision: GuestRequestDecision,
): Promise<GuestRequestResult> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown guest request." }
  if (!DECISIONS.includes(decision)) return { ok: false, error: "Invalid decision." }

  const me = await getCurrentMember()
  if (!me || !isAdmin(me.role)) return { ok: false, error: "Only admins can review guest requests." }

  // Read through the user's own client so RLS decides whether this admin can
  // see the request at all — the service-role write below never runs otherwise.
  const supabase = await createClient()
  const { data: row, error: readError } = await supabase
    .from("guest_invitations")
    .select("id, source, sub_group")
    .eq("id", id)
    .maybeSingle()

  if (readError || !row || row.source !== "guest_link") return { ok: false, error: "Guest request not found." }
  if (me.role === "admin" && !resolveSubGroups(me).includes(row.sub_group as SubGroup)) {
    return { ok: false, error: "That request belongs to another sub-group." }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: "Couldn't save that decision. Please try again." }
  }

  const { error } = await admin.from("guest_invitations").update({ status: decision }).eq("id", id)
  if (error) {
    console.error("setGuestRequestDecision error:", error.message)
    return {
      ok: false,
      error:
        error.code === "23514"
          ? "The database needs migration 021 before guests can be approved."
          : "Couldn't save that decision. Please try again.",
    }
  }

  revalidatePath("/admin")
  revalidatePath("/attendance/record", "layout")
  return { ok: true }
}
