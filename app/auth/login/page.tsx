"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/brand-mark"
import { PasskeySignInButton } from "@/components/passkey-sign-in-button"
import { Loader2 } from "lucide-react"

/**
 * Where to go after signing in.
 *
 * Only ever an in-app path: anything protocol-relative ("//evil.com") or
 * absolute is rejected, so a crafted link cannot turn our login into an open
 * redirect. Falls back to the home page.
 */
function safeNext(raw: string | null) {
  if (!raw) return "/"
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get("next"))
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // Pass through what the user must act on; genericize the rest so we
      // don't confirm whether an account exists.
      const msg = signInError.message.toLowerCase()
      if (msg.includes("not confirmed")) {
        setError("Please confirm your email address first — check your inbox for the link.")
      } else if (msg.includes("rate") || signInError.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.")
      } else if (msg.includes("invalid")) {
        setError("Invalid email or password.")
      } else {
        setError("Something went wrong signing you in. Please try again.")
        console.log("[v0] login unexpected error:", signInError.message)
      }
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <BrandMark size="lg" withTagline className="items-center text-center" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance">Welcome back</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">Sign in to record your networking activity.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              className="h-12"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgotten?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Sign in"}
            {loading ? <span className="sr-only">Signing in</span> : null}
          </Button>
        </form>

        {/* Renders nothing unless the device actually supports passkeys. */}
        <div className="mt-6">
          <PasskeySignInButton disabled={loading} next={next} />
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary above it, or the build fails
  // trying to prerender this route. Same shape as /auth/set-password.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center px-5 py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading</span>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
