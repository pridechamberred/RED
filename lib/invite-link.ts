import "server-only"

import { headers } from "next/headers"
import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SubGroup } from "@/lib/types"

/**
 * Personal guest invitation links.
 *
 * One permanent token per member, printed as a QR code. The token identifies
 * the MEMBER and never a meeting, so the same code can live on a business card
 * indefinitely — the guest chooses which meeting to attend on the public page.
 */

/** Tokens are 16 hex characters (see migration 011). */
const TOKEN_PATTERN = /^[0-9a-f]{16}$/

/** Guards against a malformed or probing token before it reaches the database. */
export function isValidInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export type InviteHost = {
  id: string
  first_name: string
  last_name: string
  company: string | null
  sub_group: SubGroup
  avatar_url: string | null
}

/**
 * The member a token belongs to, or null if it matches nobody.
 *
 * Uses the service-role client because the public guest page runs as `anon`,
 * which deliberately has no read access to `members` — the directory holds
 * every member's email. Only the handful of fields the guest page actually
 * shows are selected, so a wider row is never in memory to leak.
 */
export async function getInviteHost(token: string): Promise<InviteHost | null> {
  if (!isValidInviteToken(token)) return null

  let supabase
  try {
    supabase = createAdminClient()
  } catch (error) {
    console.error("getInviteHost: admin client unavailable:", error instanceof Error ? error.message : error)
    return null
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, company, sub_group, avatar_url")
    .eq("invite_token", token)
    .maybeSingle()

  if (error) {
    // Migration 011 not yet applied: the column does not exist, so no token can
    // resolve. Logged loudly because every scan fails until the SQL is run.
    console.error("getInviteHost error:", error.message)
    return null
  }

  return (data as InviteHost) ?? null
}

/**
 * Absolute origin of the current request.
 *
 * Read from the request headers rather than an env var so the link is correct
 * in the v0 preview, in Vercel previews and in production without any
 * configuration. `x-forwarded-host` is what Vercel sets; `host` is the
 * fallback for local dev.
 */
async function getOrigin(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000"
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/** The shareable URL a guest lands on after scanning. */
export async function buildInviteUrl(token: string): Promise<string> {
  return `${await getOrigin()}/g/${token}`
}

/**
 * The invite link as an inline SVG QR code.
 *
 * Rendered on the server so the code is present in the first paint — a member
 * holding their phone out to a stranger should never be looking at a spinner.
 * SVG rather than a raster canvas so it stays sharp when a member zooms in, or
 * prints it on a card.
 *
 * `margin: 2` is the minimum quiet zone the QR spec requires; dropping it makes
 * codes that scanners refuse to see. Error-correction level M tolerates a
 * fingerprint or a crease over roughly 15% of the code.
 */
export async function buildInviteQrSvg(url: string): Promise<string | null> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      // Colours are baked in rather than themed: a QR code must stay dark-on-light
      // to scan reliably, so it keeps a white plate even in dark mode.
      color: { dark: "#18181b", light: "#ffffff" },
    })
  } catch (error) {
    console.error("buildInviteQrSvg error:", error instanceof Error ? error.message : error)
    return null
  }
}
