"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/brand-mark"
import { signOut } from "@/app/actions"
import { PASSWORD_RULES, isPasswordValid } from "@/lib/password-policy"
import { setOwnPassword } from "./actions"
import { Check, Loader2, X } from "lucide-react"

function SetPasswordForm() {
  const router = useRouter()
  // Set by the recovery link in the reset email. Only changes the wording — the
  // proxy, not this flag, is what makes the screen mandatory.
  const isRecovery = useSearchParams().get("reason") === "recovery"
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const ruleState = useMemo(() => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })), [password])

  const matches = confirm.length > 0 && password === confirm
  const canSubmit = isPasswordValid(password) && matches && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!matches) {
      setError("Those passwords don't match.")
      return
    }

    setLoading(true)
    const result = await setOwnPassword(password)

    if (!result.ok) {
      setError(result.message)
      setLoading(false)
      return
    }

    // refresh() so the proxy re-reads the cleared flag and stops redirecting
    // back here, otherwise the member bounces straight back to this screen.
    router.replace("/")
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <BrandMark size="lg" className="items-center text-center" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-balance">
              {isRecovery ? "Choose your new password" : "Please now create your own secret password for incREDible"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {isRecovery
                ? "Your reset link checked out. Pick a new password and you'll be signed straight in."
                : "You signed in with a temporary password. Choose a private one now so only you can reach your activity."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              aria-describedby="password-rules"
            />
          </div>

          <ul id="password-rules" className="flex flex-col gap-1.5">
            {ruleState.map((rule) => (
              <li
                key={rule.id}
                className={`flex items-center gap-2 text-sm leading-relaxed ${
                  rule.passed ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {rule.passed ? (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {rule.label}
                <span className="sr-only">{rule.passed ? " — met" : " — not yet met"}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12"
            />
            {confirm.length > 0 && !matches ? (
              <p className="text-sm leading-relaxed text-muted-foreground">Those passwords don&apos;t match yet.</p>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!canSubmit}>
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Save my password"}
            {loading ? <span className="sr-only">Saving your password</span> : null}
          </Button>
        </form>

        {/*
          An escape hatch. Every other route redirects here while the flag is
          set, so without this a member who changes their mind has no way off
          this screen but to clear their cookies.
        */}
        <form action={signOut} className="mt-6 flex justify-center">
          <button
            type="submit"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </main>
  )
}

export default function SetPasswordPage() {
  // useSearchParams needs a Suspense boundary above it, or the build fails
  // trying to prerender this route.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center px-5 py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading</span>
        </main>
      }
    >
      <SetPasswordForm />
    </Suspense>
  )
}
