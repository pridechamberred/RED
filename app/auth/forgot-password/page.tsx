"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/brand-mark"
import { requestPasswordReset } from "./actions"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await requestPasswordReset(email)

    if (!result.ok) {
      setError(result.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <BrandMark size="lg" className="items-center text-center" />
          {sent ? (
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <MailCheck className="size-7" />
              </span>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-balance">Check your inbox</h1>
                {/*
                  Worded so it reads the same whether or not the address has an
                  account — the server deliberately does not say which, so this
                  must not imply one either.
                */}
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  If <span className="font-semibold text-foreground">{email}</span> belongs to a RED member, a link to
                  choose a new password is on its way. It expires in an hour and works once.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  Nothing after a few minutes? Check your spam folder, or ask an admin to confirm the email address on
                  your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-balance">Forgotten your password?</h1>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                Enter the email address you sign in with and we&apos;ll send you a link to choose a new password.
              </p>
            </div>
          )}
        </div>

        {sent ? null : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="h-12"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Email me a reset link"}
              {loading ? <span className="sr-only">Sending your reset link</span> : null}
            </Button>
          </form>
        )}

        <div className="mt-6 flex justify-center">
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
