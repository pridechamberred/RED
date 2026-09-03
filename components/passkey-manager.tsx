"use client"

import { useCallback, useEffect, useState } from "react"
import type { PasskeyListItem } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  browserSupportsPasskeys,
  formatPasskeyDate,
  isCrossOriginFrame,
  isUserCancellation,
  passkeyErrorMessage,
  passkeyLabel,
} from "@/lib/passkeys"
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react"

/**
 * Manage the passkeys registered to the signed-in member.
 *
 * Registration needs an active session, which is why this lives on the profile
 * page rather than the login screen. The list itself is fetched client-side:
 * `auth.passkey.list()` is scoped to the caller's own session, so there is no
 * server action to write and no way to read another member's devices.
 */
export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyListItem[] | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [registering, setRegistering] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadPasskeys = useCallback(async () => {
    const supabase = createClient()
    const { data, error: listError } = await supabase.auth.passkey.list()

    if (listError) {
      console.log("[v0] passkey list error:", listError.message)
      // An empty list and an unreadable list look the same to the member, so
      // show the section but say plainly that we couldn't load it.
      setPasskeys([])
      setError("Couldn't load your saved devices.")
      return
    }

    setPasskeys(data ?? [])
  }, [])

  useEffect(() => {
    const canUse = browserSupportsPasskeys() && !isCrossOriginFrame()
    setSupported(canUse)
    if (canUse) void loadPasskeys()
  }, [loadPasskeys])

  async function handleRegister() {
    setRegistering(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()

    try {
      const { error: registerError } = await supabase.auth.registerPasskey()

      if (registerError) {
        if (!isUserCancellation(registerError)) {
          setError(passkeyErrorMessage(registerError, "register"))
          console.log("[v0] passkey register error:", registerError.message)
        }
        setRegistering(false)
        return
      }

      setNotice("This device can now sign you in.")
      await loadPasskeys()
    } catch (err) {
      if (!isUserCancellation(err)) {
        setError(passkeyErrorMessage(err, "register"))
        console.log("[v0] passkey register threw:", err)
      }
    }

    setRegistering(false)
  }

  async function handleRemove(passkeyId: string) {
    setRemovingId(passkeyId)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error: deleteError } = await supabase.auth.passkey.delete({ passkeyId })

    if (deleteError) {
      setError(passkeyErrorMessage(deleteError, "register"))
      console.log("[v0] passkey delete error:", deleteError.message)
      setRemovingId(null)
      return
    }

    await loadPasskeys()
    setRemovingId(null)
  }

  // Hidden entirely while detecting, and on browsers/frames that can't do it.
  if (supported === null || supported === false) return null

  return (
    <section className="mt-8 flex flex-col gap-4" aria-labelledby="passkeys-heading">
      <div className="flex flex-col gap-1">
        <h2 id="passkeys-heading" className="text-base font-semibold tracking-tight">
          Sign in faster
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add this device to sign in with Face ID, Touch ID or your fingerprint instead of typing your password.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg bg-secondary px-3 py-2.5 text-sm leading-relaxed text-secondary-foreground">
          {notice}
        </p>
      ) : null}

      {passkeys === null ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading your devices
        </div>
      ) : passkeys.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
          No devices saved yet.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {passkeys.map((pk) => {
            const added = formatPasskeyDate(pk.created_at)
            const lastUsed = formatPasskeyDate(pk.last_used_at)
            return (
              <li key={pk.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Fingerprint className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">{passkeyLabel(pk.friendly_name)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {lastUsed ? `Last used ${lastUsed}` : added ? `Added ${added}` : "Ready to use"}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleRemove(pk.id)}
                  disabled={removingId === pk.id}
                >
                  {removingId === pk.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">Remove {passkeyLabel(pk.friendly_name)}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full text-base"
        onClick={handleRegister}
        disabled={registering}
      >
        {registering ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="sr-only">Setting up this device</span>
          </>
        ) : (
          <>
            <Plus className="size-5" aria-hidden />
            Add this device
          </>
        )}
      </Button>
    </section>
  )
}
