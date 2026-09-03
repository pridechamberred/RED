"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getAuthCallbackUrl } from "@/lib/supabase/auth-redirect"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BrandMark } from "@/components/brand-mark"
import { SUB_GROUPS } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [company, setCompany] = useState("")
  const [subGroup, setSubGroup] = useState<string>(SUB_GROUPS[0])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [existingAccount, setExistingAccount] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setExistingAccount(false)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: {
          first_name: firstName,
          last_name: lastName,
          company,
          sub_group: subGroup,
        },
      },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      if (msg.includes("password")) {
        setError(signUpError.message)
      } else if (msg.includes("rate") || signUpError.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.")
      } else if (msg.includes("already") || msg.includes("registered")) {
        setError("That email can't be used to sign up. Try signing in instead.")
      } else {
        setError("Something went wrong creating your account. Please try again.")
        console.log("[v0] sign-up unexpected error:", signUpError.message)
      }
      setLoading(false)
      return
    }

    // Supabase deliberately hides whether an email is already registered: for an
    // existing account it returns HTTP 200 with a placeholder user, no session,
    // and an EMPTY identities array — and it sends no email at all. Treating that
    // as success is what sends a member to "check your inbox" for a confirmation
    // that will never arrive, so detect it and point them at signing in instead.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setExistingAccount(true)
      setLoading(false)
      return
    }

    router.push("/auth/sign-up-success")
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <BrandMark size="lg" withTagline className="items-center text-center" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance">Create your account</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Takes a minute. Then recording activity takes seconds.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company">Business name</Label>
            <Input
              id="company"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Smith Marketing"
              className="h-12"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subGroup">Sub-group</Label>
            <Select value={subGroup} onValueChange={(v) => setSubGroup(v ?? subGroup)}>
              <SelectTrigger id="subGroup" className="h-12 w-full">
                <SelectValue>{(v: string | null) => v ?? subGroup}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUB_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          {existingAccount ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground"
            >
              <p className="font-semibold">This email already has an account</p>
              <p>
                {"No new confirmation email is sent for an existing account. Sign in instead — or "}
                <Link href="/auth/login" className="font-semibold underline underline-offset-4">
                  reset your password
                </Link>
                {" if you've forgotten it."}
              </p>
              <Link
                href="/auth/login"
                className="mt-1 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Go to sign in
              </Link>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Create account"}
            {loading ? <span className="sr-only">Creating account</span> : null}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {"Already a member? "}
          <Link href="/auth/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
