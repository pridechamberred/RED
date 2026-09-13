import Link from "next/link"
import { redirect } from "next/navigation"
import { BarChart3, ChevronRight, ClipboardCheck } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { getCurrentMember } from "@/lib/data"
import { isAdmin } from "@/lib/types"

export default async function AttendancePage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  return (
    <AppShell showAdmin>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {me.role === "super-admin"
              ? "Registers and reporting across all sub-groups."
              : `Registers and reporting for ${me.sub_group}.`}
          </p>
        </header>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/attendance/record"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <ClipboardCheck className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold leading-tight">Attendance Record</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                Mark who came to each RED meeting
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>

          <Link
            href="/attendance/report"
            className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <BarChart3 className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold leading-tight">Attendance Report</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                Meeting attendance by member, over any date range
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
