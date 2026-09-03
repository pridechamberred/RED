"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_RULES, isPasswordValid } from "@/lib/password-policy"
import { changeOwnPassword } from "@/app/profile/password/actions"
import { Check, Loader2, X } from "lucide-react"

export function ChangePasswordForm() {
  const router = useRouter()
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const ruleState = useMemo(() => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })), [password])

  const matches = confirm.length > 0 && password === confirm
  const canSubmit = current.length > 0 && isPasswordValid(password) && matches && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!matches) {
      setError("Those passwords don't match.")
      return
    }

    setLoading(true)
    const result = await changeOwnPassword(current, password)

    if (!result.ok) {
      setError(result.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    setCurrent("")
    setPassword("")
    setConfirm("")
    // The password change rotates the session cookies, so refresh to pick them
    // up rather than leaving the page holding a stale session.
    router.refresh()
  }

  if (done) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p
          role="status"
          className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm leading-relaxed text-foreground"
        >
          Your password has been changed. Use it next time you sign in.
        </p>
        <Button type="button" variant="outline" size="lg" className="h-12 text-base" onClick={() => setDone(false)}>
          Change it again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12"
          aria-describedby="change-password-rules"
        />
      </div>

      <ul id="change-password-rules" className="flex flex-col gap-1.5">
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
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
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
        {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Save new password"}
        {loading ? <span className="sr-only">Saving your new password</span> : null}
      </Button>
    </form>
  )
}
