import type { ReferralSource, RecurringFrequency } from "@/lib/types"

/** A done deal exactly as stored, with DB column names mapped to camelCase. */
export type DoneDealRecord = {
  id: string
  date: string
  dealType: "one-off" | "recurring"
  /** The one-off amount. Null for recurring deals, whose value accrues instead. */
  dealValue: number | null
  /** The amount charged each period, for recurring deals. */
  recurringValue: number | null
  recurringFrequency: RecurringFrequency | null
  /** Set once a recurring deal has stopped. Accrual halts here, permanently. */
  recurringEndedOn: string | null
  /** A manual figure that replaces the computed total, for one year only. */
  totalOverride: number | null
  totalOverrideYear: number | null
  /**
   * Where the referral behind this deal came from.
   *
   * Null means the deal was recorded before the field existed (migration 008),
   * which is deliberately distinct from any of the four answers — render it as
   * "not recorded", never as "Confidential".
   */
  referralSource: ReferralSource | null
  /**
   * The named referrer, populated only when referralSource is "member".
   *
   * Unlike the private note, this is NOT owner-only: it is a plain column on
   * done_deals and so is visible to any admin who can see the deal row. That is
   * intended — admins report on referral flow.
   */
  referralFromMemberName: string | null
  /**
   * The member's own private note about this deal, from the separate
   * public.done_deal_notes table.
   *
   * Only ever populated for the member who wrote it: the note lives in its own
   * owner-only table specifically so admin queries cannot reach it, and nothing
   * on the admin side joins to it. Null means "no note" — which is also how a
   * pending migration 006 reads, so the record degrades to no notes rather
   * than erroring.
   */
  note: string | null
}

export type DealWithTotal = DoneDealRecord & {
  /** Value accrued inside the year this was computed for. */
  yearTotal: number
  /** Payments counted inside that year. Always 0 for one-off deals. */
  periods: number
  /** True when yearTotal came from a manual override rather than accrual. */
  overridden: boolean
  /** True when this recurring deal has been stopped and will never resume. */
  stopped: boolean
}

export const FREQUENCY_ADVERB: Record<RecurringFrequency, string> = {
  week: "weekly",
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
}

export const FREQUENCY_PER: Record<RecurringFrequency, string> = {
  week: "per week",
  month: "per month",
  quarter: "per quarter",
  year: "per year",
}

/**
 * Date maths here is deliberately done on UTC date-only values and compared as
 * ISO strings. ISO dates sort lexicographically, so this sidesteps the timezone
 * drift you get from comparing Date objects built from local time.
 */
function isoOf(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * The date of the k-th payment of a recurring deal, counting the start date
 * itself as payment 0. Month-based frequencies clamp to the end of shorter
 * months, so a deal started on Jan 31 bills Feb 28 rather than skipping to
 * Mar 3.
 */
function addPeriods(startISO: string, freq: RecurringFrequency, k: number) {
  const [y, m, d] = startISO.split("-").map(Number)

  if (freq === "week") {
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 7 * k)
    return dt
  }

  const step = freq === "month" ? 1 : freq === "quarter" ? 3 : 12
  const monthIndex = m - 1 + step * k
  const year = y + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(d, lastDayOfMonth)))
}

/** Payments falling inside [windowStart, windowEnd], both inclusive. */
function countPayments(startISO: string, freq: RecurringFrequency, windowStartISO: string, windowEndISO: string) {
  if (windowEndISO < windowStartISO) return 0

  let count = 0
  // Weekly deals over a long life are the worst case; this ceiling is far
  // beyond any real one and just stops a bad date spinning forever.
  for (let k = 0; k < 20_000; k++) {
    const occurrence = isoOf(addPeriods(startISO, freq, k))
    if (occurrence > windowEndISO) break
    if (occurrence >= windowStartISO) count++
  }
  return count
}

/**
 * Whether a deal belongs on the record for `year`.
 *
 * One-off deals belong to the year they were closed. Recurring deals roll into
 * later years: they appear in any year they were still live for, which is why a
 * deal opened in November shows up again the following January.
 */
export function isInYear(deal: DoneDealRecord, year: number) {
  const jan1 = `${year}-01-01`
  const dec31 = `${year}-12-31`

  if (deal.dealType === "one-off") return deal.date >= jan1 && deal.date <= dec31
  if (deal.date > dec31) return false
  return deal.recurringEndedOn === null || deal.recurringEndedOn >= jan1
}

/**
 * The value a deal contributed during `year`, as of `todayISO`.
 *
 * Totals are scoped to the calendar year, so a recurring deal's figure resets
 * each January while the deal itself keeps running.
 */
export function computeDealTotal(deal: DoneDealRecord, year: number, todayISO: string): DealWithTotal {
  const stopped = deal.dealType === "recurring" && deal.recurringEndedOn !== null
  const overridden = deal.totalOverride !== null && deal.totalOverrideYear === year

  if (overridden) {
    return { ...deal, yearTotal: Number(deal.totalOverride), periods: 0, overridden: true, stopped }
  }

  if (deal.dealType === "one-off") {
    const inYear = isInYear(deal, year)
    return {
      ...deal,
      yearTotal: inYear ? Number(deal.dealValue ?? 0) : 0,
      periods: 0,
      overridden: false,
      stopped: false,
    }
  }

  const perPeriod = Number(deal.recurringValue ?? 0)
  const freq = deal.recurringFrequency
  if (!freq || perPeriod <= 0) {
    return { ...deal, yearTotal: 0, periods: 0, overridden: false, stopped }
  }

  const jan1 = `${year}-01-01`
  const dec31 = `${year}-12-31`

  const windowStart = deal.date > jan1 ? deal.date : jan1
  // Accrual stops at whichever comes first: today, the year end, or the date
  // the deal was stopped.
  let windowEnd = todayISO < dec31 ? todayISO : dec31
  if (deal.recurringEndedOn !== null && deal.recurringEndedOn < windowEnd) windowEnd = deal.recurringEndedOn

  const periods = countPayments(deal.date, freq, windowStart, windowEnd)
  return { ...deal, yearTotal: Math.round(perPeriod * periods * 100) / 100, periods, overridden: false, stopped }
}

/** How the deal reads in the "type / frequency" column. */
export function describeDealType(deal: DealWithTotal) {
  if (deal.dealType === "one-off") return "One-off"
  const freq = deal.recurringFrequency ? FREQUENCY_ADVERB[deal.recurringFrequency] : "recurring"
  return `Recurring · ${freq}`
}
