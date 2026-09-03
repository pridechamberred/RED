import { redirect } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { ChangePasswordForm } from "@/components/change-password-form"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"
import { ArrowLeft } from "lucide-react"

export default async function ChangePasswordPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")

  return (
    <AppShell showAdmin={isAdmin(me.role)}>
      <Link
        href="/profile"
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to profile
      </Link>

      <header className="mt-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Change your password</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Enter your current password, then choose a new one. You&apos;ll stay signed in on this device.
        </p>
      </header>

      <ChangePasswordForm />
    </AppShell>
  )
}
