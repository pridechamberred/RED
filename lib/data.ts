import { createClient } from "@/lib/supabase/server"
import {
  type ActivityRow,
  type GuestInviteRow,
  type Member,
  type MemberOption,
  type RecurringFrequency,
  type ReferralSource,
  type SubGroup,
  memberName,
  referralSourceLabel,
  todayISO,
} from "@/lib/types"
import {
  computeDealTotal,
  isInYear,
  type DealWithTotal,
  type DoneDealRecord,
} from "@/lib/deal-totals"

/**
 * The signed-in user's member record. Returns null when there is no session or
 * the member row has not been created yet.
 */
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.from("members").select("*").eq("auth_user_id", user.id).maybeSingle()

  if (error) {
    console.log("[v0] getCurrentMember error:", error.message)
    return null
  }
  return (data as Member) ?? null
}

/** Everyone except the signed-in member — this is what the search box filters over. */
export async function getSearchableMembers(excludeMemberId: string): Promise<MemberOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, company, sub_group")
    .neq("id", excludeMemberId)
    .order("first_name")

  if (error) {
    console.log("[v0] getSearchableMembers error:", error.message)
    return []
  }
  return (data as MemberOption[]) ?? []
}

// The referrer's name is embedded rather than joined by hand so it arrives with
// the deal in one round trip. public.members is readable by every authenticated
// user, so this resolves even when the referrer sits in a different sub-group
// from the admin reading the row.
const DEAL_FIELDS =
  "id, date, deal_value, deal_type, recurring_value, recurring_frequency, recurring_ended_on, total_override, total_override_year, referral_source, referral_from_member_id, referrer:members!done_deals_referral_from_member_id_fkey(first_name, last_name)"

type DealRow = {
  id: string
  date: string
  deal_value: number | null
  deal_type: "one-off" | "recurring"
  recurring_value: number | null
  recurring_frequency: RecurringFrequency | null
  recurring_ended_on: string | null
  total_override: number | null
  total_override_year: number | null
  referral_source: ReferralSource | null
  referral_from_member_id: string | null
  /** Embedded from members; null for the three non-member sources. */
  referrer: { first_name: string; last_name: string } | null
}

/**
 * The caller's own private deal notes, keyed by deal id.
 *
 * Deliberately a second query rather than a join: notes live in
 * public.done_deal_notes, which is owner-only by RLS, and joining it into
 * DEAL_FIELDS would put the column into `getActivityFeed` too — the query
 * admins use. Keeping it separate means there is no code path where an admin
 * view could pick notes up by accident.
 *
 * Tolerates migration 006 not having been run yet: a missing table returns an
 * empty map, so the record shows no notes instead of failing.
 */
async function getDealNotes(memberId: string): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("done_deal_notes")
    .select("deal_id, note")
    .eq("user_id", memberId)

  if (error) {
    console.log("[v0] getDealNotes error:", error.message)
    return new Map()
  }

  const rows = (data ?? []) as { deal_id: string; note: string }[]
  return new Map(rows.map((r) => [r.deal_id, r.note]))
}

function toDealRecord(row: DealRow, note: string | null = null): DoneDealRecord {
  return {
    note,
    id: row.id,
    date: row.date,
    dealType: row.deal_type,
    dealValue: row.deal_value === null ? null : Number(row.deal_value),
    recurringValue: row.recurring_value === null ? null : Number(row.recurring_value),
    recurringFrequency: row.recurring_frequency,
    recurringEndedOn: row.recurring_ended_on,
    totalOverride: row.total_override === null ? null : Number(row.total_override),
    totalOverrideYear: row.total_override_year,
    referralSource: row.referral_source,
    // Falls back to null rather than a placeholder: the label helper decides how
    // an unresolvable member reads, so that wording lives in one place.
    referralFromMemberName: row.referrer ? memberName(row.referrer) : null,
  }
}

/**
 * The signed-in member's done deals that count towards `year`, newest first.
 *
 * Recurring deals opened in an earlier year are included when they were still
 * live during `year`, which is how a November deal keeps accruing into January.
 */
export async function getMyDoneDeals(memberId: string, year: number): Promise<DealWithTotal[]> {
  const supabase = await createClient()
  const [dealsResult, notes] = await Promise.all([
    supabase.from("done_deals").select(DEAL_FIELDS).eq("user_id", memberId).order("date", { ascending: false }),
    getDealNotes(memberId),
  ])

  const { data, error } = dealsResult
  if (error) {
    console.log("[v0] getMyDoneDeals error:", error.message)
    return []
  }

  const today = todayISO()
  // `as unknown as` because the generated types widen a to-one embed
  // (`referrer`) to an array, while a single FK returns one row or null at
  // runtime. Same cast as the guest embed in lib/attendance.ts.
  return ((data ?? []) as unknown as DealRow[])
    .map((row) => toDealRecord(row, notes.get(row.id) ?? null))
    .filter((deal) => isInYear(deal, year))
    .map((deal) => computeDealTotal(deal, year, today))
}

/** All members (used by admin filters). */
export async function getAllMembers(): Promise<MemberOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, company, sub_group")
    .order("first_name")

  if (error) {
    console.log("[v0] getAllMembers error:", error.message)
    return []
  }
  return (data as MemberOption[]) ?? []
}

export async function getMemberById(id: string): Promise<Member | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("members").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.log("[v0] getMemberById error:", error.message)
    return null
  }
  return (data as Member) ?? null
}

type NamedMember = { id: string; first_name: string; last_name: string; sub_group: SubGroup }

const MEMBER_FIELDS = "id, first_name, last_name, sub_group"

function named(m: NamedMember | null) {
  return m ? { id: m.id, name: memberName(m), subGroup: m.sub_group } : null
}

/**
 * Reads every activity table and flattens the results into one chronological
 * feed. RLS decides what is visible, so the same function powers My Activity
 * (own rows), the admin dashboard (own sub-group) and super-admin (everything).
 *
 * `ownerId` optionally narrows to a single member's own recorded activity.
 */
export async function getActivityFeed(ownerId?: string): Promise<ActivityRow[]> {
  const supabase = await createClient()

  /**
   * Runs one activity query, optionally narrowed to a single owner. Supabase's
   * generated types can't express these dynamic embedded selects, so rows come
   * back as `unknown` and each loop below casts to its own shape.
   */
  const fetchRows = async (table: string, select: string, ownerColumn: string) => {
    const query = supabase.from(table).select(select)
    const { data, error } = await (ownerId ? query.eq(ownerColumn, ownerId) : query)
    if (error) console.log(`[v0] getActivityFeed ${table} error:`, error.message)
    return (data ?? []) as unknown[]
  }

  const [vous, referrals, deals, volunteering, events] = await Promise.all([
    fetchRows(
      "vous",
      `id, date, notes, user_id, member:members!vous_member_id_fkey(${MEMBER_FIELDS}), owner:members!vous_user_id_fkey(${MEMBER_FIELDS})`,
      "user_id",
    ),
    fetchRows(
      "referrals",
      `id, occurred_on, referred_name, referred_email, referred_phone, referred_company, details, referral_mode, referrer_user_id, recipient:members!referrals_recipient_member_id_fkey(${MEMBER_FIELDS}), owner:members!referrals_referrer_user_id_fkey(${MEMBER_FIELDS})`,
      "referrer_user_id",
    ),
    fetchRows(
      "done_deals",
      `${DEAL_FIELDS}, user_id, owner:members!done_deals_user_id_fkey(${MEMBER_FIELDS})`,
      "user_id",
    ),
    fetchRows(
      "volunteering",
      `id, date, organization, hours, notes, user_id, owner:members!volunteering_user_id_fkey(${MEMBER_FIELDS})`,
      "user_id",
    ),
    fetchRows(
      "chamber_events",
      `id, date, event_name, hours, notes, user_id, owner:members!chamber_events_user_id_fkey(${MEMBER_FIELDS})`,
      "user_id",
    ),
  ])

  const rows: ActivityRow[] = []

  const base = (owner: NamedMember | null) => {
    const o = named(owner)
    return {
      memberId: o?.id ?? "",
      memberName: o?.name ?? "Unknown member",
      memberSubGroup: (o?.subGroup ?? "RED Central") as SubGroup,
    }
  }

  for (const r of vous) {
    const row = r as { id: string; date: string; notes: string | null; member: NamedMember; owner: NamedMember }
    const other = named(row.member)
    rows.push({
      id: row.id,
      type: "vous",
      date: row.date,
      ...base(row.owner),
      otherMemberId: other?.id ?? null,
      otherMemberName: other?.name ?? null,
      subject: null,
      value: null,
      recurring: false,
      recurringValue: null,
      recurringFrequency: null,
      hours: null,
      notes: row.notes,
    })
  }

  for (const r of referrals) {
    const row = r as {
      id: string
      // Since migration 009: when the referral was actually passed on, which
      // for an offline referral is earlier than when it was entered.
      occurred_on: string
      referred_name: string
      // Null for an offline referral — the recipient already knows the details.
      details: string | null
      referral_mode: string
      recipient: NamedMember
      owner: NamedMember
    }
    const other = named(row.recipient)
    rows.push({
      id: row.id,
      type: "referral",
      date: row.occurred_on,
      ...base(row.owner),
      otherMemberId: other?.id ?? null,
      otherMemberName: other?.name ?? null,
      subject: row.referred_name,
      value: null,
      recurring: false,
      recurringValue: null,
      recurringFrequency: null,
      hours: null,
      // An offline referral has no details to show, so the feed says how it was
      // passed instead of rendering an empty line.
      notes: row.referral_mode === "offline" ? "Passed on in person" : row.details,
    })
  }

  // Done deal values are accrued, not stored, so the feed reports each deal's
  // running total for the current year. That keeps the admin "Deal value" stat
  // in step with what members see on the Done Deals Record.
  const today = todayISO()
  const currentYear = Number(today.slice(0, 4))

  for (const r of deals) {
    const row = r as DealRow & { owner: NamedMember }
    // toDealRecord is called without a note on purpose. This feed is what the
    // admin dashboard renders, and a member's deal note is private to them —
    // so `notes` below stays null for done deals. Do not join done_deal_notes
    // in here.
    const deal = computeDealTotal(toDealRecord(row), currentYear, today)
    rows.push({
      id: row.id,
      type: "done_deal",
      date: row.date,
      ...base(row.owner),
      otherMemberId: null,
      otherMemberName: null,
      subject: null,
      value: deal.yearTotal,
      recurring: row.deal_type === "recurring",
      recurringValue: deal.recurringValue,
      recurringFrequency: deal.recurringFrequency,
      hours: null,
      notes: null,
      // Resolved to a label here so the feed carries no member id for the
      // referrer — the admin views only ever display this, never link from it.
      referralSourceLabel: referralSourceLabel(deal.referralSource, deal.referralFromMemberName),
    })
  }

  for (const r of volunteering) {
    const row = r as {
      id: string
      date: string
      organization: string
      hours: number
      notes: string | null
      owner: NamedMember
    }
    rows.push({
      id: row.id,
      type: "volunteering",
      date: row.date,
      ...base(row.owner),
      otherMemberId: null,
      otherMemberName: null,
      subject: row.organization,
      value: null,
      recurring: false,
      recurringValue: null,
      recurringFrequency: null,
      hours: Number(row.hours),
      notes: row.notes,
    })
  }

  for (const r of events) {
    const row = r as {
      id: string
      date: string
      event_name: string
      hours: number | null
      notes: string | null
      owner: NamedMember
    }
    rows.push({
      id: row.id,
      type: "chamber_event",
      date: row.date,
      ...base(row.owner),
      otherMemberId: null,
      otherMemberName: null,
      subject: row.event_name,
      value: null,
      recurring: false,
      recurringValue: null,
      recurringFrequency: null,
      hours: row.hours === null ? null : Number(row.hours),
      notes: row.notes,
    })
  }

  // Attendance is recorded BY an admin ABOUT a member, so it belongs in that
  // member's own feed (My Activity, and the admin member drill-down) but not in
  // the all-activity roll-up, where one meeting would add a row per member.
  if (ownerId) {
    rows.push(...(await getAttendanceRows(ownerId)))
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Formats a timestamptz as a YYYY-MM-DD date in the meeting's own timezone. */
const attendanceDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** One feed row per meeting this member was marked attended/absent/substitute for. */
async function getAttendanceRows(ownerId: string): Promise<ActivityRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("meeting_attendance")
    .select(`id, meeting_start, meeting_title, status, owner:members!meeting_attendance_member_id_fkey(${MEMBER_FIELDS})`)
    .eq("member_id", ownerId)
    .order("meeting_start", { ascending: false })

  if (error) {
    console.log("[v0] getAttendanceRows error:", error.message)
    return []
  }

  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as {
      id: string
      meeting_start: string
      meeting_title: string
      status: "attended" | "absent" | "substitute"
      owner: NamedMember | null
    }
    const owner = named(row.owner)
    return {
      id: row.id,
      type: "meeting_attendance" as const,
      date: attendanceDateFormat.format(new Date(row.meeting_start)),
      memberId: owner?.id ?? ownerId,
      memberName: owner?.name ?? "Unknown member",
      memberSubGroup: (owner?.subGroup ?? "RED Central") as SubGroup,
      otherMemberId: null,
      otherMemberName: null,
      subject: row.meeting_title,
      value: null,
      recurring: false,
      recurringValue: null,
      recurringFrequency: null,
      hours: null,
      notes: null,
      attendanceStatus: row.status,
    }
  })
}

/**
 * Guest invitations, reduced to what the admin stats need.
 *
 * Not part of `getActivityFeed`: guests are not a tracked activity type and must
 * not appear as feed rows. RLS scopes this the same way as the feed, via
 * `can_view_member(inviter_user_id)` — own sub-group for admins, everything for
 * super-admins.
 */
export async function getGuestInvites(): Promise<GuestInviteRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("guest_invitations")
    .select(`id, created_at, inviter_user_id, inviter:members!guest_invitations_inviter_user_id_fkey(${MEMBER_FIELDS})`)
    .order("created_at", { ascending: false })

  if (error) {
    console.log("[v0] getGuestInvites error:", error.message)
    return []
  }

  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as {
      id: string
      created_at: string
      inviter_user_id: string
      inviter: NamedMember | null
    }
    const inviter = named(row.inviter)
    return {
      id: row.id,
      date: row.created_at.slice(0, 10),
      memberId: inviter?.id ?? row.inviter_user_id,
      memberSubGroup: (inviter?.subGroup ?? "RED Central") as SubGroup,
    }
  })
}

/** Referrals RECEIVED by a member — needed for the admin member summary. */
export async function getReferralsReceivedCount(memberId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("recipient_member_id", memberId)

  if (error) {
    console.log("[v0] getReferralsReceivedCount error:", error.message)
    return 0
  }
  return count ?? 0
}
