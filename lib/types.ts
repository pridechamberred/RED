export const SUB_GROUPS = ["RED Central", "RED Uptown", "RED Downtown", "RED West", "RED Connect"] as const

export type SubGroup = (typeof SUB_GROUPS)[number]

export type Role = "user" | "admin" | "super-admin"

export type Member = {
  id: string
  auth_user_id: string | null
  first_name: string
  last_name: string
  email: string
  company: string | null
  role: Role
  /**
   * The member's PRIMARY sub-group: a single value that satisfies the DB CHECK
   * and drives every display and single-group code path. Always one of the five.
   */
  sub_group: SubGroup
  /**
   * ALL sub-groups the member belongs to, including the primary (migration 015).
   *
   * A member can be a full member of more than one group. Membership scoping —
   * who appears on a register, which admins can see them, and which groups their
   * attendance is reported under — is driven by this list, not by `sub_group`.
   *
   * Optional in the type because `getCurrentMember` uses `select("*")`: before
   * 015 runs the column is simply absent from the row, and `resolveSubGroups`
   * falls back to `[sub_group]`, so the app behaves exactly as it did before.
   */
  sub_groups?: SubGroup[] | null
  /** Uploaded profile picture. Null means "no picture" — render initials. */
  avatar_url: string | null
  /**
   * Permanent personal guest-invite token (migration 011).
   *
   * Optional in the type because `getCurrentMember` uses `select("*")`: before
   * the migration runs the column is simply absent from the row. Callers treat
   * that as "QR codes not switched on yet" rather than failing, so deploying
   * this code before running the SQL degrades one panel instead of the app.
   */
  invite_token?: string | null
  created_at: string
}

/** A member as needed by the search box — no email, so we don't ship inboxes to the client. */
export type MemberOption = {
  id: string
  first_name: string
  last_name: string
  company: string | null
  sub_group: SubGroup
  /** All of the member's groups (migration 015). Absent pre-015 — see `Member`. */
  sub_groups?: SubGroup[] | null
  avatar_url: string | null
}

/** One eligible imported event, ready to show in the chamber-event dropdown. */
export type PrideChamberEventOption = {
  id: string
  title: string
  /** YYYY-MM-DD (Eastern). */
  eventDate: string
  /** Prebuilt "Title — Month D, YYYY" label. */
  label: string
}

export type ActivityType =
  | "vous"
  | "referral"
  | "done_deal"
  | "volunteering"
  | "chamber_event"
  | "meeting_attendance"

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  vous: "Vous",
  referral: "Referral",
  done_deal: "Done Deal",
  volunteering: "Volunteering",
  chamber_event: "Chamber Event",
  meeting_attendance: "RED Meeting",
}

export type RecurringFrequency = "week" | "month" | "quarter" | "year"

/**
 * Where the referral behind a done deal came from.
 *
 * `member` is the only one that names somebody — it pairs with a member id.
 * The other three are deliberately anonymous categories, so a deal can credit
 * a referral without identifying anyone outside the group.
 */
export const REFERRAL_SOURCES = ["confidential", "pride-chamber", "former-red-member", "member"] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]

/** How each source reads in a dropdown, on the record and in the admin feed. */
export const REFERRAL_SOURCE_LABELS: Record<Exclude<ReferralSource, "member">, string> = {
  confidential: "Confidential",
  "pride-chamber": "Pride Chamber (non-RED) member",
  "former-red-member": "Former RED member",
}

/**
 * The display label for a recorded source.
 *
 * `member` resolves to the named member; `null` means the deal predates the
 * field (migration 008), which is a different thing from any real answer and so
 * gets its own wording rather than being lumped in with "Confidential".
 */
export function referralSourceLabel(source: ReferralSource | null, memberName: string | null) {
  if (source === null) return "Not recorded"
  if (source === "member") return memberName ?? "A RED member"
  return REFERRAL_SOURCE_LABELS[source]
}

/** One row in a unified activity feed (My Activity + Admin dashboard). */
export type ActivityRow = {
  id: string
  type: ActivityType
  date: string
  /** The member who recorded the activity. */
  memberId: string
  memberName: string
  memberSubGroup: SubGroup
  /** The other group member involved, when there is one. */
  otherMemberId: string | null
  otherMemberName: string | null
  /** Referred person, organization or event name. Null for done deals. */
  subject: string | null
  value: number | null
  recurring: boolean
  recurringValue: number | null
  recurringFrequency: RecurringFrequency | null
  hours: number | null
  notes: string | null
  /**
   * Done deals only: where the referral behind the deal came from, already
   * resolved to a display label (see `referralSourceLabel`). Undefined on every
   * other activity type, which has no referral source.
   *
   * Unlike a deal's private note, this IS shown to admins — it is a plain
   * column on done_deals, and reporting on referral flow is the point of the
   * field.
   */
  referralSourceLabel?: string
  /**
   * Attendance rows only: what the admin recorded. Undefined on every other
   * activity type, which has no notion of attendance.
   *
   * `"substitute"` means the member sent someone in their place. It is its own
   * category and must not be rendered as either attended or absent.
   */
  attendanceStatus?: "attended" | "absent" | "substitute"
  /** Free-text stand-in name, only ever set on a substitute attendance row. */
  substituteName?: string | null
}

/**
 * A guest invitation reduced to just what the admin stats need.
 *
 * Guests are not one of the five tracked activity types and stay out of the
 * activity feed, but they are counted on the admin dashboard, so they travel
 * alongside `ActivityRow[]` rather than inside it.
 */
export type GuestInviteRow = {
  id: string
  /** Date the invitation was created, YYYY-MM-DD. */
  date: string
  /** The member who invited the guest. */
  memberId: string
  memberSubGroup: SubGroup
}

/**
 * Every sub-group a member belongs to, always as a non-empty list.
 *
 * Reads `sub_groups` (migration 015) when present and valid, otherwise falls
 * back to `[sub_group]`. This is THE single place membership is resolved, so a
 * pre-015 database (no `sub_groups` column) and a member left on one group both
 * behave identically to the old single-group model.
 */
export function resolveSubGroups(m: { sub_group: SubGroup; sub_groups?: SubGroup[] | null }): SubGroup[] {
  const list = (m.sub_groups ?? []).filter((g): g is SubGroup => SUB_GROUPS.includes(g as SubGroup))
  // De-dupe defensively; the DB trigger keeps this clean but direct edits may not.
  const unique = [...new Set(list)]
  return unique.length > 0 ? unique : [m.sub_group]
}

/** True when the two group lists share at least one sub-group. */
export function subGroupsOverlap(a: readonly SubGroup[], b: readonly SubGroup[]): boolean {
  return a.some((g) => b.includes(g))
}

/** Display string for a member's groups, e.g. "RED Central, RED Uptown". */
export function formatSubGroups(m: { sub_group: SubGroup; sub_groups?: SubGroup[] | null }): string {
  return resolveSubGroups(m).join(", ")
}

export function memberName(m: { first_name: string; last_name: string }) {
  return `${m.first_name} ${m.last_name}`
}

export function initials(m: { first_name: string; last_name: string }) {
  return `${m.first_name.charAt(0)}${m.last_name.charAt(0)}`.toUpperCase()
}

export function isAdmin(role: Role) {
  return role === "admin" || role === "super-admin"
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function todayISO() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}
