import { redirect } from "next/navigation"
import Link from "next/link"
import { signOut } from "@/app/actions"
import { AppShell } from "@/components/app-shell"
import { PasskeyManager } from "@/components/passkey-manager"
import { Button } from "@/components/ui/button"
import { getCurrentMember } from "@/lib/data"
import { initials, isAdmin, memberName } from "@/lib/types"
import { KeyRound, LogOut } from "lucide-react"

const ROLE_LABELS = {
  user: "Member",
  admin: "Admin",
  "super-admin": "Super Admin",
} as const

export default async function ProfilePage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  const rows = [
    { label: "Business", value: me.company || "—" },
    { label: "Email", value: me.email },
    { label: "Sub-group", value: me.sub_group },
    { label: "Role", value: ROLE_LABELS[me.role] },
  ]

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <header className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground"
        >
          {initials(me)}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{memberName(me)}</h1>
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[me.role]}</p>
        </div>
      </header>

      <dl className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-3.5">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 truncate text-right text-sm font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>

      <PasskeyManager />

      <Button
        render={<Link href="/profile/password" />}
        nativeButton={false}
        variant="outline"
        size="lg"
        className="mt-6 h-12 w-full text-base"
      >
        <KeyRound className="size-5" aria-hidden />
        Change password
      </Button>

      <form action={signOut} className="mt-3">
        <Button type="submit" variant="outline" size="lg" className="h-12 w-full text-base">
          <LogOut className="size-5" aria-hidden />
          Sign out
        </Button>
      </form>
    </AppShell>
  )
}
