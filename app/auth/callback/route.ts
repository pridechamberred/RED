import { createClient } from "@/lib/supabase/server"
import { RECOVERY_COOKIE } from "@/lib/auth-recovery"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

function toError(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(reason)}`)
}



export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? "/"

  // Supabase signals a rejected link by redirecting here with error params
  // instead of a token. Handle it first, otherwise we fall through to the
  // generic "missing code" branch and lose the real reason.
  const errorCode = searchParams.get("error_code")
  if (errorCode) {
    console.log("[v0] auth callback rejected by Supabase:", errorCode)
    return toError(origin, errorCode)
  }

  // PKCE flow (browser sign-up): ?code=
  const code = searchParams.get("code")
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.log("[v0] auth callback exchange failed:", error.message)
    return toError(origin, error.code ?? "exchange_failed")
  }

  // Verify flow (email templates using {{ .TokenHash }}): ?token_hash=&type=
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)

      // A verified recovery link signs the member in but leaves their
      // forgotten password in place, and the proxy would bounce them off the
      // set-password screen because nothing marks it as needed.
      //
      // This is a cookie rather than the must_change_password metadata flag on
      // purpose: writing that flag through the admin API does NOT update the
      // session JWT already in the member's cookies, which is exactly what the
      // proxy reads — so the proxy would still see "false" and redirect them
      // home without ever letting them set a password.
      //
      // Set only AFTER the token verifies, so submitting someone's address
      // cannot force a password change on them.
      if (type === "recovery") {
        response.cookies.set(RECOVERY_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          // Comfortably longer than choosing a password takes, short enough
          // that an abandoned attempt cannot strand them on that screen.
          maxAge: 15 * 60,
        })
      }

      return response
    }
    console.log("[v0] auth callback verifyOtp failed:", error.message)
    return toError(origin, error.code ?? "verify_failed")
  }

  return toError(origin, "missing_token")
}
