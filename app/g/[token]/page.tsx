import type { Metadata } from "next"
import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"
import { MemberAvatar } from "@/components/member-avatar"
import { GuestRegisterForm, type GuestMeeting } from "@/app/g/[token]/guest-register-form"
import { CALENDAR_TIME_ZONE } from "@/lib/calendar"
import { getInviteHost } from "@/lib/invite-link"
import { GUEST_MEETING_LIMIT, getMeetingOptions } from "@/lib/meeting-options"
import { memberName } from "@/lib/types"

/**
 * The public page a guest lands on after scanning a member's QR code.
 *
 * No login, and no member data beyond the host's name, company and photo — the
 * token identifies who invited them, nothing more.
 */

export const metadata: Metadata = {
  title: "You're invited to RED",
  description: "Pick a RED Group meeting and register as a guest.",
  // A personal invite link has no business appearing in search results.
  robots: { index: false, follow: false },
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
})

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

const monthFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  month: "long",
  year: "numeric",
})

/** "Venue Name, 123 St, City, FL" → just the venue name. */
function venueName(location: string | null): string | null {
  if (!location) return null
  const first = location.split(",")[0]?.trim()
    return first && first.length > 0 ? first : null
}

export default async function GuestInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const host = await getInviteHost(token)

  // A bad token gets a friendly dead end rather than a 404 — the likeliest
  // cause is a half-scanned code, and the guest is standing next to the person
  // who can just show it to them again.
  if (!host) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-[34rem] flex-col justify-center gap-6 px-5 py-12">
        <BrandMark />
        <div className="flex flex-col gap-2 rounded-3xl border border-border bg-card px-5 py-8">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-balance">
            This invitation isn&apos;t valid
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            The link may have been mistyped or only partly scanned. Ask the RED member to show you their QR code
            again — theirs never expires.
          </p>
        </div>
      </main>
    )
  }

  const meetings = await getMeetingOptions(GUEST_MEETING_LIMIT)

  const meetingChoices: GuestMeeting[] = meetings.map((meeting) => {
    const start = new Date(meeting.startISO)
    return {
      id: meeting.id,
      group: meeting.title,
      day: dayFormat.format(start),
      time: timeFormat.format(start),
      month: monthFormat.format(start),
      venue: venueName(meeting.location),
      online: /zoom|online|virtual/i.test(`${meeting.title} ${meeting.location ?? ""}`),
    }
  })

  const hostName = memberName(host)

  return (
    <main className="mx-auto flex w-full max-w-[34rem] flex-col gap-8 px-5 pb-16 pt-10">
      <header className="flex flex-col gap-6">
        <BrandMark />

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <MemberAvatar member={host} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Invited by
              </span>
              <span className="truncate font-semibold leading-tight">{hostName}</span>
              {host.company ? (
                <span className="truncate text-sm leading-relaxed text-muted-foreground">{host.company}</span>
              ) : null}
            </div>
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
            {`${host.first_name} wants you at `}
            <span className="text-primary">RED</span>
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground text-pretty">
            RED is the Pride Chamber&apos;s referral network — small groups of business owners who meet regularly to
            pass each other real work. Come as a guest and see what you think.
          </p>
        </div>
      </header>

      <GuestRegisterForm token={token} hostFirstName={host.first_name} meetings={meetingChoices} />

      <footer className="flex flex-col gap-2 border-t border-border pt-6">
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Already a RED member?{" "}
          <Link href="/auth/login" className="font-semibold text-foreground underline underline-offset-2">
            Sign in here
          </Link>
        </p>
      </footer>
    </main>
  )
}
