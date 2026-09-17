"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember } from "@/lib/data"
import { createAdminClient } from "@/lib/supabase/admin"
import { PASSWORD_MIN_LENGTH, isPasswordValid } from "@/lib/password-policy"
import { SUB_GROUPS, type Role, type SubGroup, isAdmin } from "@/lib/types"

export type NewMemberInput = {
  firstName: string
  lastName: string
  email: string
  company: string
  /** One or more groups. The first (in SUB_GROUPS order) becomes the primary. */
  subGroups: string[]
  role: string
  password: string
}

export type AddMemberResult =
  | {
      ok: true
      member: { name: string; email: string; company: string | null; subGroups: SubGroup[]; role: Role }
      password: string
    }
  | { ok: false; message: string }

const ASSIGNABLE_ROLES: Role[] = ["user", "admin", "super-admin"]

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** True when a write failed only because `members.sub_groups` (migration 015)
 * does not exist yet, so we can retry the write without it. */
function isMissingSubGroupsColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (error.message?.toLowerCase().includes("sub_groups") ?? false)
  )
}

/**
 * Creates a member record plus a matching login, in that order of dependency.
 *
 * Every check here is deliberately server-side. The form hides the role picker
 * from ordinary admins, but a hidden field is not a control: without the
 * re-check below an admin could POST `role: "super-admin"` with an email they
 * own and grant themselves sight of all five sub-groups' activity.
 */
export async function addMember(input: NewMemberInput): Promise<AddMemberResult> {
  const me = await getCurrentMember()

  if (!me) {
    return { ok: false, message: "Your session has expired. Please sign in again." }
  }
  if (!isAdmin(me.role)) {
    return { ok: false, message: "Only admins can add members." }
  }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim().toLowerCase()
  const company = input.company.trim()
  const password = input.password

  if (!firstName || !lastName) {
    return { ok: false, message: "Please enter both a first and last name." }
  }
  if (!isEmail(email)) {
    return { ok: false, message: "Please enter a valid email address." }
  }

  // Canonicalise to valid groups in SUB_GROUPS order; the first is the primary.
  const subGroups = SUB_GROUPS.filter((g) => input.subGroups.includes(g))
  if (subGroups.length === 0) {
    return { ok: false, message: "Please choose at least one sub-group." }
  }
  if (!ASSIGNABLE_ROLES.includes(input.role as Role)) {
    return { ok: false, message: "Please choose a valid permission level." }
  }

  const subGroup = subGroups[0]
  const role = input.role as Role

  // Only super-admins may hand out elevated access.
  if (role !== "user" && me.role !== "super-admin") {
    return { ok: false, message: "Only a super-admin can grant admin access. Please add this person as a member." }
  }

  if (!isPasswordValid(password)) {
    return {
      ok: false,
      message: `The first-time password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, a number and a special character.`,
    }
  }

  const admin = createAdminClient()

  // Check for an existing member row first so a duplicate gives a clear message
  // rather than a raw constraint violation.
  const { data: existingMember, error: lookupError } = await admin
    .from("members")
    .select("id, first_name, last_name, auth_user_id")
    .eq("email", email)
    .maybeSingle()

  if (lookupError) {
    console.error("addMember lookup failed:", lookupError.message)
    return { ok: false, message: "We couldn't check the member list just now. Please try again." }
  }
  if (existingMember) {
    return {
      ok: false,
      message: `${existingMember.first_name} ${existingMember.last_name} is already on the member list with that email.`,
    }
  }

  // The login is created pre-confirmed so onboarding needs no email at all, and
  // flagged so the proxy forces a password change on first sign-in.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      company: company || null,
      sub_group: subGroup,
      must_change_password: true,
    },
  })

  if (createError || !created.user) {
    const detail = createError?.message ?? "unknown error"
    console.error("addMember createUser failed:", detail)

    if (detail.toLowerCase().includes("already been registered") || detail.toLowerCase().includes("already exists")) {
      return { ok: false, message: "That email already has a login. Ask them to sign in instead." }
    }
    return { ok: false, message: "We couldn't create that login. Please try again." }
  }

  const authUserId = created.user.id

  // A database trigger creates the member row from the metadata above. Set the
  // fields it cannot know (role, and the full sub_groups list) and re-assert the
  // rest, so the record is correct even if the deployed trigger is an older
  // revision. `sub_groups` (migration 015) may not exist yet, so retry without
  // it on a missing-column error — pre-015 the member is simply single-group.
  const updatePayload = {
    first_name: firstName,
    last_name: lastName,
    company: company || null,
    sub_group: subGroup,
    sub_groups: subGroups,
    role,
  }
  const runUpdate = (payload: Record<string, unknown>) =>
    admin.from("members").update(payload).eq("auth_user_id", authUserId).select("id").maybeSingle()

  let { data: updated, error: updateError } = await runUpdate(updatePayload)
  if (updateError && isMissingSubGroupsColumn(updateError)) {
    const { sub_groups: _omit, ...withoutGroups } = updatePayload
    ;({ data: updated, error: updateError } = await runUpdate(withoutGroups))
  }

  let memberRowId = updated?.id ?? null

  // No row means the trigger did not fire — insert it directly.
  if (!updateError && !memberRowId) {
    const insertPayload = {
      auth_user_id: authUserId,
      first_name: firstName,
      last_name: lastName,
      email,
      company: company || null,
      sub_group: subGroup,
      sub_groups: subGroups,
      role,
    }
    const runInsert = (payload: Record<string, unknown>) =>
      admin.from("members").insert(payload).select("id").maybeSingle()

    let { data: inserted, error: insertError } = await runInsert(insertPayload)
    if (insertError && isMissingSubGroupsColumn(insertError)) {
      const { sub_groups: _omit, ...withoutGroups } = insertPayload
      ;({ data: inserted, error: insertError } = await runInsert(withoutGroups))
    }

    if (insertError) {
      console.error("addMember insert failed:", insertError.message)
    } else {
      memberRowId = inserted?.id ?? null
    }
  }

  // Never leave a login with no member record behind: such an account can sign
  // in but the app cannot resolve it to a member, which is exactly the orphan
  // state we had to clean up manually before.
  if (!memberRowId) {
    await admin.auth.admin.deleteUser(authUserId)
    return { ok: false, message: "We couldn't save the member record, so nothing was created. Please try again." }
  }

  revalidatePath("/admin")

  return {
    ok: true,
    member: { name: `${firstName} ${lastName}`, email, company: company || null, subGroups, role },
    password,
  }
}
