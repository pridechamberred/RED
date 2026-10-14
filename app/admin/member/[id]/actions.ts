"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember } from "@/lib/data"
import { createAdminClient } from "@/lib/supabase/admin"
import { SUB_GROUPS, type SubGroup } from "@/lib/types"

export type UpdateSubGroupsResult = { ok: true; subGroups: SubGroup[] } | { ok: false; message: string }

/** Postgres undefined_column (select) / PostgREST unknown-column (write) — the
 * `sub_groups` column is not in the database yet (migration 015 not run). */
function isMissingSubGroupsColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (error.message?.toLowerCase().includes("sub_groups") ?? false)
  )
}

/**
 * Sets the full list of sub-groups a member belongs to.
 *
 * Super-admin only: changing a member's groups changes which admins can see
 * them and which registers they appear on, so it is not something a single
 * sub-group admin should do to shared records. The primary `sub_group` is
 * realigned to the first selected group; the DB trigger enforces the same, but
 * we send both so it is correct even before that trigger exists.
 */
export async function updateMemberSubGroups(
  memberId: string,
  subGroups: string[],
): Promise<UpdateSubGroupsResult> {
  const me = await getCurrentMember()
  if (!me) return { ok: false, message: "Your session has expired. Please sign in again." }
  if (me.role !== "super-admin") {
    return { ok: false, message: "Only a super-admin can change a member's sub-groups." }
  }

  // Canonicalise: keep only valid groups, de-dupe, and order by SUB_GROUPS so the
  // primary (first element) is deterministic.
  const chosen = SUB_GROUPS.filter((g) => subGroups.includes(g))
  if (chosen.length === 0) {
    return { ok: false, message: "Choose at least one sub-group." }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("members")
    .update({ sub_group: chosen[0], sub_groups: chosen })
    .eq("id", memberId)

  if (error) {
    if (isMissingSubGroupsColumn(error)) {
      return {
        ok: false,
        message:
          "The multi-group column isn't in the database yet. Run migration 015 (supabase/migrations/015-member-multi-sub-group.sql), then try again.",
      }
    }
    console.error("updateMemberSubGroups error:", error.message)
    return { ok: false, message: "We couldn't save that just now. Please try again." }
  }

  revalidatePath(`/admin/member/${memberId}`)
  revalidatePath("/admin")
  return { ok: true, subGroups: chosen }
}

export type EditableRole = "user" | "admin"
export type UpdateRoleResult = { ok: true; role: EditableRole } | { ok: false; message: string }

/**
 * Switches a member between "user" and "admin". Super-admin only. Super-admin
 * accounts (including the caller's own) are never changed here, so this can't be
 * used to demote the people who manage roles.
 */
export async function updateMemberRole(memberId: string, role: string): Promise<UpdateRoleResult> {
  const me = await getCurrentMember()
  if (!me) return { ok: false, message: "Your session has expired. Please sign in again." }
  if (me.role !== "super-admin") {
    return { ok: false, message: "Only a super-admin can change a member's role." }
  }
  if (role !== "user" && role !== "admin") {
    return { ok: false, message: "Choose either User or Admin." }
  }
  if (memberId === me.id) {
    return { ok: false, message: "You can't change your own role." }
  }

  const admin = createAdminClient()
  const { data: target, error: lookupError } = await admin
    .from("members")
    .select("id, role")
    .eq("id", memberId)
    .maybeSingle()

  if (lookupError || !target) {
    return { ok: false, message: "We couldn't find that member." }
  }
  if (target.role === "super-admin") {
    return { ok: false, message: "Super-admin roles can't be changed here." }
  }

  const { error } = await admin.from("members").update({ role }).eq("id", memberId)
  if (error) {
    console.error("updateMemberRole error:", error.message)
    return { ok: false, message: "We couldn't save that just now. Please try again." }
  }

  revalidatePath(`/admin/member/${memberId}`)
  revalidatePath("/admin")
  return { ok: true, role }
}
