import { notFound, redirect } from "next/navigation"
import { MapPin, UserPlus } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { FormHeader } from "@/components/form-header"
import { AttendanceToggle } from "@/components/attendance-toggle"
import { getCurrentMember } from "@/lib/data"
import { findRegisterMeeting, getRegister, meetingDateFormat } from "@/lib/attendance"
import { isAdmin } from "@/lib/types"

export default async function AttendanceRegisterPage({
  params,
}: {
  params: Promise<{ meetingId: string }>
}) {
  const { meetingId } = await params
  const id = decodeURIComponent(meetingId)

  const me = await getCurrentMember()
  if (!me) redirect("/auth/login")
  if (!isAdmin(me.role)) redirect("/")

  const meeting = await findRegisterMeeting(id)
  if (!meeting || !meeting.subGroup) notFound()

  // An admin may only register meetings of their own sub-group.
  if (me.role === "admin" && meeting.subGroup !== me.sub_group) redirect("/admin/attendance")

  const { members, guests } = await getRegister(meeting)

  // Counts anyone an admin has ruled on, whichever status they chose — so
  // substitutes count as recorded, and only "not recorded" is excluded.
  const recorded = members.filter((m) => m.status !== null).length

  return (
    <AppShell showAdmin>
      <FormHeader
        title={meeting.title}
        subtitle={meetingDateFormat.format(new Date(meeting.startISO))}
        backHref="/admin/attendance"
        backLabel="Attendance Record"
      />

      {meeting.location ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span>{meeting.location}</span>
        </p>
      ) : null}

      <section className="mt-8 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {`${meeting.subGroup} members`}
          </h2>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {`${recorded} of ${members.length} recorded`}
          </span>
        </div>

        {members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {`No members are assigned to ${meeting.subGroup} yet.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold leading-tight">{member.name}</span>
                  {member.detail ? (
                    <span className="truncate text-sm text-muted-foreground">{member.detail}</span>
                  ) : null}
                </div>
                <AttendanceToggle
                  meetingId={meeting.id}
                  subjectKind="member"
                  subjectId={member.id}
                  name={member.name}
                  initial={member.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9 flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Invited guests</h2>

        {guests.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            <UserPlus className="size-4 shrink-0" aria-hidden />
            No guests were invited to this meeting.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-card px-4 py-3.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold leading-tight">{guest.name}</span>
                  <span className="text-sm text-muted-foreground">{`Guest of ${guest.invitedBy}`}</span>
                </div>
                <AttendanceToggle
                  meetingId={meeting.id}
                  subjectKind="guest"
                  subjectId={guest.id}
                  name={guest.name}
                  initial={guest.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
