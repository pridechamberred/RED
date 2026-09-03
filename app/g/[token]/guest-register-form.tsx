"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, CalendarRange, Check, MapPin, PartyPopper, Video } from "lucide-react"
import { registerGuest } from "@/app/g/[token]/actions"
import { FormError } from "@/components/form-error"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * How many meeting dates show before "show all".
 *
 * Eight covers roughly the next two weeks across all five sub-groups, which is
 * the window nearly every guest picks from.
 */
const INITIAL_VISIBLE = 8

/** A meeting as the guest page needs it — pre-formatted on the server. */
export type GuestMeeting = {
  id: string
  /** e.g. "RED Central" */
  group: string
  /** e.g. "Tue, Sep 8" */
  day: string
  /** e.g. "11:30 AM EDT" */
  time: string
  /** Month heading used to group the list, e.g. "September". */
  month: string
  venue: string | null
  online: boolean
}

/**
 * The guest's whole journey: pick a meeting, give three details, done.
 *
 * Deliberately short. The person filling this in is standing at a networking
 * event with a drink in one hand, so the form asks only what the group actually
 * needs to greet them at the door and follow up afterwards.
 */
export function GuestRegisterForm({
  token,
  hostFirstName,
  meetings,
}: {
  token: string
  hostFirstName: string
  meetings: GuestMeeting[]
}) {
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hostName: string; meetingLabel: string; meetingId: string } | null>(null)

  const [showAll, setShowAll] = useState(false)

  // Only the soonest few are shown until asked for more. All 40 dates are
  // available, but rendering them all up front pushes the name and email
  // fields several screens down on a phone — and most guests come to the next
  // meeting or two, not one in four months' time.
  const visible = showAll ? meetings : meetings.slice(0, INITIAL_VISIBLE)
  const hiddenCount = meetings.length - visible.length

  // Grouped by month so the list reads as a calendar rather than a wall of
  // dates. Order is preserved from the server (soonest first).
  const months = useMemo(() => {
    const byMonth = new Map<string, GuestMeeting[]>()
    for (const meeting of visible) {
      const bucket = byMonth.get(meeting.month)
      if (bucket) bucket.push(meeting)
      else byMonth.set(meeting.month, [meeting])
    }
    return [...byMonth.entries()]
  }, [visible])

  if (done) {
    return (
      <section className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card px-5 py-9 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <PartyPopper className="size-7" />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-balance">You&apos;re on the list!</h2>
          <p className="mx-auto max-w-[28rem] text-sm leading-relaxed text-muted-foreground text-pretty">
            {`We've let ${done.hostName} know you're coming to ${done.meetingLabel}. They'll be looking out for you — bring plenty of business cards.`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <a
            href={`/g/${token}/calendar?meeting=${encodeURIComponent(done.meetingId)}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Add to calendar
          </a>
          <a
            href={`/g/${token}/calendar?meeting=${encodeURIComponent(done.meetingId)}&provider=google`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold transition-colors hover:bg-accent/60"
          >
            Add to Google Calendar
          </a>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Apple Calendar and Outlook use the first button. Either way, we&apos;ve got you down.
        </p>
      </section>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!meetingId) {
      setError("Please choose which meeting you'd like to come to.")
      return
    }

    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    form.set("token", token)
    form.set("meetingId", meetingId)

    const res = await registerGuest(form)

    if (res.ok) {
      setDone({ hostName: res.hostName, meetingLabel: res.meetingLabel, meetingId: res.meetingId })
    } else {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="flex flex-col gap-1">
          <span className="text-lg font-bold leading-tight tracking-tight">Pick a meeting</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Any group, any date — come to whichever suits you.
          </span>
        </legend>

        {meetings.length === 0 ? (
          <p className="rounded-2xl border border-border bg-muted/40 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
            {`Meeting dates can't be loaded right now. Please try again in a few minutes, or message ${hostFirstName} directly.`}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {months.map(([month, group]) => (
              <div key={month} className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{month}</h3>

                <div className="flex flex-col gap-2">
                  {group.map((meeting) => {
                    const selected = meetingId === meeting.id
                    return (
                      <label
                        key={meeting.id}
                        className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-colors ${
                          selected
                            ? "border-primary bg-accent/60 ring-1 ring-primary"
                            : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                        }`}
                      >
                        {/* A real radio, visually hidden: keyboard and screen
                            reader behaviour comes free, and arrow keys move
                            through the list as one group. */}
                        <input
                          type="radio"
                          name="meetingChoice"
                          value={meeting.id}
                          checked={selected}
                          onChange={() => {
                            setMeetingId(meeting.id)
                            setError(null)
                          }}
                          className="peer sr-only"
                        />

                        <span
                          aria-hidden
                          className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-full text-[0.68rem] font-bold leading-none transition-colors ${
                            selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {selected ? (
                            <Check className="size-5" />
                          ) : (
                            <>
                              <span className="text-[0.6rem] font-semibold uppercase opacity-70">
                                {meeting.day.split(",")[0]}
                              </span>
                              <span className="text-sm">{meeting.day.split(" ").pop()}</span>
                            </>
                          )}
                        </span>

                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold leading-tight">{meeting.group}</span>
                          <span className="text-sm leading-relaxed text-muted-foreground">
                            {meeting.day} · {meeting.time}
                          </span>
                          {meeting.venue ? (
                            <span className="flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground">
                              {meeting.online ? (
                                <Video className="size-3 shrink-0" aria-hidden />
                              ) : (
                                <MapPin className="size-3 shrink-0" aria-hidden />
                              )}
                              <span className="truncate">{meeting.venue}</span>
                            </span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-accent/60"
              >
                <CalendarRange className="size-4" aria-hidden />
                {`Show ${hiddenCount} more date${hiddenCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="flex flex-col gap-1">
          <span className="text-lg font-bold leading-tight tracking-tight">And you are?</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Just so we know who to expect at the door.
          </span>
        </legend>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guestName">Your name</Label>
          <Input id="guestName" name="guestName" required autoComplete="name" className="h-12" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guestEmail">Your email</Label>
          <Input
            id="guestEmail"
            name="guestEmail"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            className="h-12"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guestCompany">
            Company <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="guestCompany" name="guestCompany" autoComplete="organization" className="h-12" />
        </div>
      </fieldset>

      <FormError message={error} />

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending || meetings.length === 0}
          className="flex h-14 items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving your spot..." : "Count me in"}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground text-pretty">
          {`We'll only use your details to let ${hostFirstName} and the group know you're coming.`}
        </p>
      </div>
    </form>
  )
}
