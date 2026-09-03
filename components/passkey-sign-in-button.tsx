"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  browserSupportsPasskeys,
  isCrossOriginFrame,
  isUserCancellation,
  passkeyErrorMessage,
} from "@/lib/passkeys"
import { Fingerprint, Loader2 } from "lucide-react"

/**
 * Secondary sign-in path using a device passkey (Face ID / Touch ID / Windows
 * Hello / Android biometrics).
 *
 * Renders nothing at all when the browser lacks WebAuthn or when we're inside a
 * cross-origin frame, since the ceremony cannot succeed there and a permanently
 * failing button is worse than no button.
 *
 * No email field: Supabase issues a discoverable-credential challenge, so the
 * platform authenticator itself resolves which account to use.
 */
export function PasskeySignInButton({
  disabled,
  // Where to land after signing in. Kept in step with the password form so a
  // deep link survives either sign-in method, not just the one we tested.
  next = "/",
}: {
  disabled?: boolean
  next?: string
}) {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Capability detection must run after mount — `window` doesn't exist during
  // SSR, and rendering the button server-side would flash it for browsers that
  // can't use it.
  useEffect(() => {
    setSupported(browserSupportsPasskeys() && !isCrossOriginFrame())
  }, [])

  if (!supported) return null

  async function handlePasskeySignIn() {
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { error: signInError } = await supabase.auth.signInWithPasskey()

      if (signInError) {
        if (!isUserCancellation(signInError)) {
          setError(passkeyErrorMessage(signInError, "sign-in"))
          console.log("[v0] passkey sign-in error:", signInError.message)
        }
        setLoading(false)
        return
      }

      router.push(next)
      router.refresh()
    } catch (err) {
      // The WebAuthn ceremony rejects (rather than returning an error) when the
      // user dismisses the sheet or the domain is wrong.
      if (!isUserCancellation(err)) {
        setError(passkeyErrorMessage(err, "sign-in"))
        console.log("[v0] passkey sign-in threw:", err)
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full text-base"
        onClick={handlePasskeySignIn}
        disabled={loading || disabled}
      >
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="sr-only">Signing in with your device</span>
          </>
        ) : (
          <>
            <Fingerprint className="size-5" aria-hidden />
            Sign in with Face ID or fingerprint
          </>
        )}
      </Button>
    </div>
  )
}
