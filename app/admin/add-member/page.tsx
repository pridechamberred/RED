import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { AddMemberForm } from "@/components/forms/add-member-form"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"
import { ChevronLeft } from "lucide-react"

export default async function AddMemberPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  return (
    <AppShell showAdmin>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Admin
      </Link>

      <header className="mt-4 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Add a member</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          This creates their record and their sign-in together. Choose a first-time password to pass on — they&apos;ll
          be asked to replace it with their own the first time they sign in.
        </p>
      </header>

      <AddMemberForm canAssignRoles={me.role === "super-admin"} defaultSubGroup={me.sub_group} />
    </AppShell>
  )
}
