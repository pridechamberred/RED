"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormError } from "@/components/form-error"
import { PASSWORD_RULES, isPasswordValid } from "@/lib/password-policy"
import { SUB_GROUPS, type Role, type SubGroup } from "@/lib/types"
import { addMember, type AddMemberResult } from "@/app/admin/add-member/actions"
import { Check, Copy, Loader2, X } from "lucide-react"

const ROLE_LABELS: Record<Role, string> = {
  user: "Member",
  admin: "Admin — sees their own sub-group",
  "super-admin": "Super-admin — sees every sub-group",
}

type Created = Extract<AddMemberResult, { ok: true }>

export function AddMemberForm({
  canAssignRoles,
  defaultSubGroup,
}: {
  canAssignRoles: boolean
  defaultSubGroup: SubGroup
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [subGroup, setSubGroup] = useState<SubGroup>(defaultSubGroup)
  const [role, setRole] = useState<Role>("user")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  const ruleState = useMemo(() => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })), [password])
  const matches = confirm.length > 0 && password === confirm

  if (created) {
    const summary = [
      `incREDible sign-in for ${created.member.name}`,
      `Email: ${created.member.email}`,
      `First-time password: ${created.password}`,
      "You'll be asked to choose your own password when you first sign in.",
    ].join("\n")

    return (
      <div className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold tracking-tight">{created.member.name} has been added</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Pass these details on personally — no email has been sent. They&apos;ll be prompted to create their own
            password the first time they sign in.
          </p>

          <dl className="mt-2 flex flex-col gap-2 text-sm leading-relaxed">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all text-right font-semibold">{created.member.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">First-time password</dt>
              <dd className="break-all text-right font-mono font-semibold">{created.password}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Sub-group</dt>
              <dd className="text-right font-semibold">{created.member.subGroup}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Permission</dt>
              <dd className="text-right font-semibold">{ROLE_LABELS[created.member.role].split(" — ")[0]}</dd>
            </div>
          </dl>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full text-base"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(summary)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Copy className="size-5" aria-hidden />
          {copied ? "Copied" : "Copy sign-in details"}
        </Button>

        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base"
          onClick={() => {
            setCreated(null)
            setCopied(false)
            setFirstName("")
            setLastName("")
            setEmail("")
            setCompany("")
            setRole("user")
            setPassword("")
            setConfirm("")
            setPending(false)
          }}
        >
          Add another member
        </Button>

        <Button render={<Link href="/admin" />} nativeButton={false} variant="ghost" className="h-11 w-full">
          Back to admin
        </Button>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!matches) {
      setError("Those passwords don't match.")
      return
    }

    setPending(true)
    const result = await addMember({ firstName, lastName, email, company, subGroup, role, password })

    if (result.ok) {
      setCreated(result)
      return
    }

    setError(result.message)
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            required
            autoComplete="off"
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
            autoComplete="off"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="h-12"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">This is the email they will sign in with.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subGroup">Sub-group</Label>
        <Select value={subGroup} onValueChange={(v) => setSubGroup((v as SubGroup) ?? subGroup)}>
          <SelectTrigger id="subGroup" className="h-12 w-full" aria-label="Sub-group">
            <SelectValue>{(v: string | null) => v ?? "Select a sub-group"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUB_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canAssignRoles ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Permission level</Label>
          <Select value={role} onValueChange={(v) => setRole((v as Role) ?? role)}>
            <SelectTrigger id="role" className="h-12 w-full" aria-label="Permission level">
              <SelectValue>{(v: string | null) => (v ? ROLE_LABELS[v as Role] : "Member")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Admins and super-admins can read other members&apos; activity, so grant this sparingly.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">First-time password</Label>
        <Input
          id="password"
          type="text"
          autoComplete="off"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 font-mono"
          aria-describedby="password-rules"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Shown in plain text so you can pass it on. They must change it when they first sign in.
        </p>
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
        <Label htmlFor="confirmPassword">Confirm first-time password</Label>
        <Input
          id="confirmPassword"
          type="text"
          autoComplete="off"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-12 font-mono"
        />
        {confirm.length > 0 && !matches ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Those passwords don&apos;t match yet.</p>
        ) : null}
      </div>

      <FormError message={error} />

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={pending || !isPasswordValid(password) || !matches}
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Add member"}
        {pending ? <span className="sr-only">Adding member</span> : null}
      </Button>
    </form>
  )
}
