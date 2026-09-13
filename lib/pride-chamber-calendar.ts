import "server-only"

import { easternTodayISO, shiftISODate, toUSDate } from "@/lib/eastern-date"

/**
 * Server-side scraper for The Pride Chamber's public GrowthZone event calendar.
 *
 * The public calendar at
 *   https://business.thepridechamber.org/event-calendar/
 * exposes a date-range filter that GETs to `/event-calendar/Search?from=&to=`
 * (MM/DD/YYYY). That endpoint returns the events *for exactly that window* as
 * server-rendered HTML — so we can ask for the previous 31 days directly rather
 * than scraping only the default (future-leaning) view and paginating backwards.
 *
 * Each event is a schema.org/Event block carrying:
 *   - a Details link `.../Details/<slug>-<numericId>` — the numericId is a
 *     stable per-occurrence id, used as the dedup key;
 *   - `itemprop="startDate" content="M/D/YYYY h:mm:ss AM"` in the venue's local
 *     (Eastern) wall time;
 *   - the title as the text of the `gz-card-title` anchor.
 *
 * Nothing here throws: the calendar is a third party, so a failure returns
 * `{ ok: false }` and the caller keeps the last-good data.
 */

const SEARCH_URL = "https://business.thepridechamber.org/event-calendar/Search"
const USER_AGENT =
  "incREDibleBot/1.0 (+https://red.poolsyde.com; The Pride Chamber RED activity tracker)"
const REQUEST_TIMEOUT_MS = 15_000

/** How far back the attendance dropdown reaches: today plus the previous 31 days. */
export const ELIGIBILITY_WINDOW_DAYS = 31

export type ScrapedEvent = {
  /** Stable GrowthZone occurrence id (the trailing digits of the Details URL). */
  sourceId: string
  title: string
  /** Calendar date in Eastern time, `YYYY-MM-DD`. */
  eventDate: string
  detailUrl: string | null
}

export type ScrapeResult =
  | { ok: true; events: ScrapedEvent[]; fromISO: string; toISO: string; parsedCount: number }
  | { ok: false; error: string; fromISO: string; toISO: string }

/**
 * Titles containing these terms are RED Group / RED Connect meetings. Members
 * log those through the attendance register, not this form, so they are kept
 * out of the dropdown. Matched case-insensitively against the TITLE only — a
 * description that merely mentions "RED Group" must not exclude an event.
 */
const EXCLUDED_TITLE_TERMS = ["red group", "red connect"]

export function isExcludedTitle(title: string): boolean {
  const t = title.toLowerCase()
  return EXCLUDED_TITLE_TERMS.some((term) => t.includes(term))
}

/** "8/13/2026 11:30:00 AM" (Eastern wall time) -> "2026-08-13". */
function parseStartDate(content: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(content)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const pad = (s: string) => s.padStart(2, "0")
  return `${yyyy}-${pad(mm)}-${pad(dd)}`
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extracts events from the calendar HTML. Tolerant by design: an event block
 * missing an id, date, or title is skipped rather than throwing, so an upstream
 * markup tweak degrades to fewer events instead of a crash.
 */
export function parseCalendarHtml(html: string): ScrapedEvent[] {
  const blocks = html.split('itemtype="http://schema.org/Event"').slice(1)
  const events: ScrapedEvent[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    const idMatch = /event-calendar\/Details\/[A-Za-z0-9-]+?-(\d+)\?/.exec(block)
    const dateMatch = /itemprop="startDate"\s+content="([^"]+)"/i.exec(block)
    const titleMatch = /class="[^"]*gz-card-title[^"]*"[^>]*itemprop="url"[^>]*>([^<]+)</i.exec(block)
    if (!idMatch || !dateMatch || !titleMatch) continue

    const sourceId = idMatch[1]
    const eventDate = parseStartDate(dateMatch[1])
    const title = decodeEntities(titleMatch[1])
    if (!eventDate || !title) continue

    // An occurrence id is unique, but de-dupe defensively in case a card is
    // rendered twice (e.g. once in a list and once in a related block).
    if (seen.has(sourceId)) continue
    seen.add(sourceId)

    const urlMatch =
      /href="(https:\/\/business\.thepridechamber\.org\/event-calendar\/Details\/[^"]+)"/i.exec(block)

    events.push({
      sourceId,
      title,
      eventDate,
      detailUrl: urlMatch ? decodeEntities(urlMatch[1]) : null,
    })
  }

  return events
}

/**
 * Fetches the calendar for the previous `days`-day window (Eastern), inclusive
 * of today, and returns the eligible events.
 *
 * The Search endpoint already bounds the range, but the results are re-checked
 * here against the window and the title exclusions so a change in the endpoint's
 * behaviour can never leak a future or RED Group event into members' options.
 */
export async function scrapePrideChamberEvents(
  now: Date = new Date(),
  days = ELIGIBILITY_WINDOW_DAYS,
): Promise<ScrapeResult> {
  const toISO = easternTodayISO(now)
  const fromISO = shiftISODate(toISO, -days)
  const url = `${SEARCH_URL}?from=${encodeURIComponent(toUSDate(fromISO))}&to=${encodeURIComponent(
    toUSDate(toISO),
  )}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    console.log(`[v0] pride-chamber scrape: GET ${url}`)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Calendar responded ${response.status} ${response.statusText}`,
        fromISO,
        toISO,
      }
    }

    const html = await response.text()
    const parsed = parseCalendarHtml(html)
    const events = parsed.filter(
      (e) => e.eventDate >= fromISO && e.eventDate <= toISO && !isExcludedTitle(e.title),
    )

    console.log(
      `[v0] pride-chamber scrape: ${parsed.length} parsed, ${events.length} eligible (window ${fromISO}..${toISO})`,
    )
    return { ok: true, events, fromISO, toISO, parsedCount: parsed.length }
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : err.message
        : String(err)
    console.log(`[v0] pride-chamber scrape threw: ${error}`)
    return { ok: false, error, fromISO, toISO }
  } finally {
    clearTimeout(timeout)
  }
}
