import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { EmailTemplateEditor } from "@/components/admin/email-template-editor"
import { getCurrentMember } from "@/lib/data"
import { isSuperAdmin } from "@/lib/types"
import { getAllEmailOverrides } from "@/lib/email-copy"

export default async function EmailTemplatesPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  // Super-admin only — a plain admin cannot reach this page.
  if (!isSuperAdmin(me.role)) redirect("/")

  const overrides = await getAllEmailOverrides()

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
        <h1 className="text-2xl font-bold tracking-tight text-balance">Email templates</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Edit the wording of every email the app sends. The layout, branding and the values in{" "}
          <span className="font-mono text-xs">{"{braces}"}</span> are handled automatically — change the copy, preview
          it with sample details, and save.
        </p>
      </header>

      <div className="mt-6">
        <EmailTemplateEditor overrides={overrides} />
      </div>
    </AppShell>
  )
}
