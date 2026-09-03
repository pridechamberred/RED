/**
 * Shared passkey (WebAuthn) helpers for the login and profile screens.
 *
 * Passkeys are an experimental feature of auth-js 2.112 — `experimental.passkey`
 * must be set on the browser client (see lib/supabase/client.ts) or every call
 * here throws at call time.
 *
 * Important constraint: a passkey is cryptographically bound to the Relying
 * Party ID configured in Supabase, which must match the page's own origin. It
 * therefore cannot work on a preview/staging domain that differs from the
 * configured RP ID, nor inside a cross-origin iframe (the v0 preview) where the
 * WebAuthn ceremony is blocked outright. Both cases surface as a normal
 * "couldn't be used here" message rather than a crash.
 */

/**
 * True when the browser exposes the WebAuthn APIs we need.
 *
 * auth-js keeps its own `browserSupportsWebAuthn()` internal (only types and
 * errors are exported from the package root), so we do the check ourselves
 * rather than reaching into its private modules.
 */
export function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator?.credentials?.get === "function"
  )
}

/**
 * True when the WebAuthn ceremony is very likely to be blocked because we are
 * running inside a cross-origin frame — which is exactly the v0 preview.
 *
 * Reading `window.top.origin` throws on a cross-origin parent, so the throw
 * itself is the signal.
 */
export function isCrossOriginFrame(): boolean {
  if (typeof window === "undefined") return false
  if (window.self === window.top) return false
  try {
    // Touching an opaque parent's origin throws; reaching this line means the
    // parent is same-origin and WebAuthn will still work.
    return window.top?.location.origin !== window.location.origin
  } catch {
    return true
  }
}

/**
 * A user cancelling the biometric sheet is not an error worth showing.
 *
 * The spec reports both a deliberate dismissal and a ceremony timeout as
 * `NotAllowedError`, so we cannot distinguish them — staying silent is right for
 * a dismissal and merely unhelpful for the rarer timeout.
 */
export function isUserCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  const code = (error as { code?: string }).code
  return name === "NotAllowedError" || name === "AbortError" || code === "webauthn_user_cancelled"
}

/** Turn a passkey failure into something a member can act on. */
export function passkeyErrorMessage(error: unknown, context: "sign-in" | "register"): string {
  const raw = (
    (error as { message?: string } | null)?.message ?? String(error ?? "")
  ).toLowerCase()
  const name = (error as { name?: string } | null)?.name

  // Wrong domain, or an iframe/insecure context: the single most likely failure
  // outside production, and the one a generic message would leave unexplained.
  if (name === "SecurityError" || raw.includes("relying party") || raw.includes("rp id") || raw.includes("origin")) {
    return context === "sign-in"
      ? "Face ID / fingerprint sign-in isn't available on this address. Please use the app's main web address."
      : "This device can't be set up on this address. Please use the app's main web address."
  }
  if (name === "InvalidStateError") {
    return "This device already has a passkey for your account."
  }
  if (raw.includes("not enabled") || raw.includes("experimental") || raw.includes("disabled")) {
    return "Passkeys aren't enabled for this app yet. Please sign in with your password."
  }
  if (raw.includes("no credentials") || raw.includes("not found") || raw.includes("no passkey")) {
    return context === "sign-in"
      ? "No passkey found on this device. Sign in with your password, then add one from your profile."
      : "That passkey could no longer be found."
  }
  if (raw.includes("rate") || (error as { status?: number } | null)?.status === 429) {
    return "Too many attempts. Please wait a moment and try again."
  }

  return context === "sign-in"
    ? "Couldn't sign you in with this device. Please use your password."
    : "Couldn't set up this device. Please try again."
}

/** Friendly label for a saved passkey, falling back when unnamed. */
export function passkeyLabel(friendlyName?: string): string {
  const trimmed = friendlyName?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "Unnamed device"
}

/** e.g. "2 Sep 2026" — matches the terse style used elsewhere in the app. */
export function formatPasskeyDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
