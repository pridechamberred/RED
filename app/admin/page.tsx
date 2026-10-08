import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { AdminDashboard } from "@/components/admin-dashboard"
import { GuestRequests } from "@/components/guest-requests"
import { getActivityFeed, getAllMembers, getCurrentMember, getGuestInvites, getGuestRequests } from "@/lib/data"
import { isAdmin, resolveSubGroups, subGroupsOverlap } from "@/lib/types"

export default async function AdminPage() {
  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  // RLS already scopes these: admins see their own sub-group, super-admins all.
  const [rows, allMembers, guestInvites, allGuestRequests] = await Promise.all([
    getActivityFeed(),
    getAllMembers(),
    getGuestInvites(),
    getGuestRequests(),
  ])

  const guestRequests =
    me.role === "super-admin"
      ? allGuestRequests
      : allGuestRequests.filter((r) => resolveSubGroups(me).includes(r.subGroup))

  // A sub-group admin sees every member who shares one of their groups, so a
  // member of two groups shows up for both groups' admins.
  const myGroups = resolveSubGroups(me)
  const members =
    me.role === "super-admin"
      ? allMembers
      : allMembers.filter((m) => subGroupsOverlap(resolveSubGroups(m), myGroups))

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
        canManageEmailTemplates={me.role === "super-admin"}
        guestRequestsSection={<GuestRequests requests={guestRequests} />}
      />
    </AppShell>
  )
}
