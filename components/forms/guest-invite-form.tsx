"use client"

import { useState } from "react"
import { inviteGuest } from "@/app/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormError } from "@/components/form-error"
import { RecordSuccess } from "@/components/record-success"
import { SubmitButton } from "@/components/submit-button"
import { NO_MEETING } from "@/lib/meeting-constants"
import { SUB_GROUPS, type SubGroup } from "@/lib/types"

/** Mirrors `MeetingOption` minus the fields the client has no business sending back. */
export type MeetingChoice = {
  id: string
  label: string
  subGroup: SubGroup | null
}

export function GuestInviteForm({
  defaultSubGroup,
  meetings,
}: {
  defaultSubGroup: SubGroup
  meetings: MeetingChoice[]
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ done: boolean; note?: string }>({ done: false })
  const [meetingId, setMeetingId] = useState<string>(NO_MEETING)
  const [subGroup, setSubGroup] = useState<SubGroup>(defaultSubGroup)

  const chosenMeeting = meetings.find((m) => m.id === meetingId) ?? null

  // A meeting settles the group, so the picker is only needed without one. Some
  // titles may not map to a sub-group (e.g. a one-off event), in which case we
  // still ask rather than guess.
  const needsGroupPicker = !chosenMeeting || chosenMeeting.subGroup === null

  if (result.done) {
    return (
      <RecordSuccess
        title="Guest invited!"
        note={result.note}
        againHref="/invite-guest"
        againLabel="Invite another guest"
      />
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    form.set("meetingId", meetingId)
    if (needsGroupPicker) form.set("subGroup", subGroup)

    const res = await inviteGuest(form)
    if (res.ok) {
      setResult({ done: true, note: res.note })
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="guestName">Guest&apos;s name</Label>
        <Input id="guestName" name="guestName" required autoComplete="off" className="h-12" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="guestEmail">Guest&apos;s email</Label>
        <Input
          id="guestEmail"
          name="guestEmail"
          type="email"
          inputMode="email"
          required
          autoComplete="off"
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meetingId">Which meeting are you inviting them to?</Label>
        <Select value={meetingId} onValueChange={(v) => setMeetingId(v ?? NO_MEETING)}>
          <SelectTrigger
            id="meetingId"
            className="h-12 w-full"
            aria-label="Which meeting are you inviting them to?"
          >
            <SelectValue>
              {(v: string | null) => (v === NO_MEETING || v === null ? "Not sure yet" : chosenMeeting?.label)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MEETING}>Not sure yet</SelectItem>
            {meetings.map((meeting) => (
              <SelectItem key={meeting.id} value={meeting.id}>
                {meeting.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {meetings.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Meeting dates couldn&apos;t be loaded just now, so pick the group instead.
          </p>
        ) : null}
      </div>

      {needsGroupPicker ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="subGroup">Group they&apos;ll attend</Label>
          <Select value={subGroup} onValueChange={(v) => setSubGroup((v as SubGroup) ?? subGroup)}>
            <SelectTrigger id="subGroup" className="h-12 w-full" aria-label="Group they'll attend">
              <SelectValue>{(v: string | null) => v ?? "Select a group"}</SelectValue>
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
      ) : (
        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-sm text-muted-foreground">Group they&apos;ll attend</span>
          <span className="text-sm font-semibold text-foreground">{chosenMeeting?.subGroup}</span>
        </div>
      )}

      <FormError message={error} />

      <SubmitButton pending={pending}>Invite Guest</SubmitButton>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Email invitations and RSVPs are coming soon — for now this saves the guest so you can follow up yourself.
      </p>
    </form>
  )
}
