import "server-only"

import { headers } from "next/headers"

/**
 * Canonical public root of the app.
 *
 * Used for links that get printed or emailed — a QR code on a business card, a
 * link inside an email — where the URL must always be the branded production
 * domain rather than whatever host happened to serve the request (a preview
 * deployment, or an old *.vercel.app alias). Override with NEXT_PUBLIC_SITE_URL
 * if the domain ever changes again; otherwise it is the registered domain.
 */
export const CANONICAL_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://redgroup.app").replace(/\/+$/, "")

/**
 * Origin of the current request, from Vercel's forwarded headers.
 *
 * `x-forwarded-host` is what Vercel sets; `host` is the fallback for local dev.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/**
 * Origin to embed in links that leave the app: emails and printed QR codes.
 *
 * On real production — `VERCEL_ENV === "production"`, which is true for every
 * production alias, including the old red-tracker.vercel.app — this is always
 * the canonical domain, so an emailed or printed link is stable and on-brand no
 * matter which alias generated it. On preview deployments and local dev it
 * falls back to the request's own origin, so a tester's links point at the
 * deployment they are actually on rather than sending them to production.
 */
export async function getPublicOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") return CANONICAL_SITE_URL
  return getRequestOrigin()
}
