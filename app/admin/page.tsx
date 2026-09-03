import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { AdminDashboard } from "@/components/admin-dashboard"
import { getActivityFeed, getAllMembers, getCurrentMember, getGuestInvites } from "@/lib/data"
import { isAdmin } from "@/lib/types"

export default async function AdminPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  // RLS already scopes these: admins see their own sub-group, super-admins all.
  const [rows, allMembers, guestInvites] = await Promise.all([
    getActivityFeed(),
    getAllMembers(),
    getGuestInvites(),
  ])

  const members =
    me.role === "super-admin" ? allMembers : allMembers.filter((m) => m.sub_group === me.sub_group)

  const scopeLabel =
    me.role === "super-admin" ? "All activity across all sub-groups" : `All activity in ${me.sub_group}`

  return (
    <AppShell showAdmin>
      <AdminDashboard
        rows={rows}
        members={members}
        guestInvites={guestInvites}
        scopeLabel={scopeLabel}
        canFilterSubGroup={me.role === "super-admin"}
      />
    </AppShell>
  )
}
