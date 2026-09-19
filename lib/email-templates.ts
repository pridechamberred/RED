/**
 * The single source of truth for every editable piece of email copy.
 *
 * This module is intentionally free of server-only imports (no Resend, no
 * Supabase) so it can be pulled into the client editor for field metadata and
 * defaults, while the actual HTML/branding/escaping stays locked in
 * `lib/email.ts`. A super-admin edits the *copy* here; they can never touch the
 * layout, the merge logic, or the escaping that keeps untrusted names safe.
 *
 * Each field's `default` is the verbatim wording the app shipped with. Stored
 * overrides (see `email_template_overrides`) are layered ON TOP of these
 * defaults per field, so any field a super-admin never touches keeps tracking
 * the code default even if we reword it later.
 *
 * Copy may contain `{token}` placeholders. At send time the token is replaced
 * with a value the builder computes from real data — and in the HTML build the
 * value is escaped, never the other way around. Removing a token from a field
 * simply drops that value from the sentence.
 */

export type EmailAudience = "member" | "guest" | "internal"

export type EmailFieldDef = {
  /** Stable key stored in the overrides JSON. Never rename without a migration. */
  key: string
  label: string
  help?: string
  /** Render a textarea rather than a single-line input. */
  multiline?: boolean
  default: string
}

export type EmailVariableDef = {
  /** Token name without braces, e.g. "recipientFirstName" for `{recipientFirstName}`. */
  token: string
  label: string
  /** Value substituted in the live preview so wording can be judged in context. */
  sample: string
}

export type EmailTemplateMeta = {
  id: string
  name: string
  description: string
  audience: EmailAudience
  /** The sending identity/branding, shown in the editor. Not editable here. */
  sender: string
  fields: EmailFieldDef[]
  variables: EmailVariableDef[]
}

export const AUDIENCE_LABELS: Record<EmailAudience, string> = {
  member: "Sent to members",
  guest: "Sent to guests & prospects",
  internal: "Internal alerts",
}

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: "password-reset",
    name: "Password reset",
    description: "Carries the one-time link a member uses to choose a new password.",
    audience: "member",
    sender: "incREDible",
    fields: [
      { key: "subject", label: "Subject line", default: `Reset your incREDible password` },
      { key: "eyebrow", label: "Eyebrow label", default: `Password reset` },
      { key: "heading", label: "Heading", default: `Reset your incREDible password` },
      {
        key: "intro",
        label: "Intro",
        multiline: true,
        default: `Hi {recipientFirstName}, we received a request to reset your password. Click the button below to choose a new one.`,
      },
      { key: "buttonLabel", label: "Button label", default: `Choose a new password` },
      {
        key: "expiryNote",
        label: "Expiry note",
        default: `This link expires in {expiresIn} and can only be used once.`,
      },
      {
        key: "securityNote",
        label: "Security note",
        multiline: true,
        default: `If you didn't ask for this, you can safely ignore this email — your password will not change until you use the link above.`,
      },
      {
        key: "fallbackNote",
        label: "Fallback note (button link is shown after this)",
        default: `If the button doesn't work, paste this into your browser:`,
      },
    ],
    variables: [
      { token: "recipientFirstName", label: "Member's first name", sample: "Jordan" },
      { token: "expiresIn", label: "How long the link lasts", sample: "1 hour" },
    ],
  },
  {
    id: "referral",
    name: "New referral",
    description: "Tells a member a fellow RED member has passed them a live referral to follow up.",
    audience: "member",
    sender: "incREDible",
    fields: [
      { key: "subject", label: "Subject line", default: `Referral from {referrerName}: {referredName}` },
      { key: "eyebrow", label: "Eyebrow label", default: `New referral` },
      { key: "heading", label: "Heading", default: `{referrerName} has referred a great contact to you` },
      {
        key: "intro",
        label: "Intro",
        multiline: true,
        default: `Hi {recipientFirstName}, this is a referral from your fellow RED member {referrerName}{referrerCompanySuffix}.`,
      },
      { key: "contactLabel", label: "Contact box heading", default: `Who to contact` },
      { key: "reasonLabel", label: "Reason box heading", default: `Why they're being referred` },
      {
        key: "footerNote",
        label: "Closing note",
        multiline: true,
        default: `Reach out soon while the introduction is fresh. When closed business results from it, record it in incREDible as a Done Deal.`,
      },
    ],
    variables: [
      { token: "recipientFirstName", label: "Recipient's first name", sample: "Jordan" },
      { token: "referrerName", label: "Referrer's full name", sample: "Jamie Rivera" },
      {
        token: "referrerCompanySuffix",
        label: "Referrer's company, as ' of Acme Ltd' (blank if none)",
        sample: " of Rivera Design",
      },
      { token: "referredName", label: "Referred person's name", sample: "Alex Chen" },
    ],
  },
  {
    id: "offline-referral",
    name: "Offline referral logged",
    description: "A quiet, no-action confirmation that a member logged a referral already passed in person.",
    audience: "member",
    sender: "incREDible",
    fields: [
      { key: "subject", label: "Subject line", default: `Referral logged: {referredName}` },
      { key: "eyebrow", label: "Eyebrow label", default: `Logged for the record` },
      { key: "heading", label: "Heading", default: `{referrerName} logged a referral to you` },
      {
        key: "body1",
        label: "First paragraph",
        multiline: true,
        default: `Hi {recipientFirstName}, no action needed — this is just a note for your records. {referrerName} has recorded that they passed you a referral for {referredName} on {occurredOn}.`,
      },
      {
        key: "body2",
        label: "Second paragraph",
        multiline: true,
        default: `Because this one was passed on in person, there are no contact details here — you should already have them. If business comes of it, record it in incREDible as a Done Deal.`,
      },
    ],
    variables: [
      { token: "recipientFirstName", label: "Recipient's first name", sample: "Jordan" },
      { token: "referrerName", label: "Referrer's full name", sample: "Jamie Rivera" },
      { token: "referredName", label: "Referred person's name", sample: "Alex Chen" },
      { token: "occurredOn", label: "Date it was passed (formatted)", sample: "Tue, Sep 1, 2026" },
    ],
  },
  {
    id: "vous-logged",
    name: "Vous logged nudge",
    description: "Nudges a member to log their side of a vous someone else recorded with them.",
    audience: "member",
    sender: "incREDible",
    fields: [
      { key: "subject", label: "Subject line", default: `{loggerName} logged a vous with you` },
      { key: "greeting", label: "Greeting", default: `Hey {recipientFirstName},` },
      {
        key: "body1",
        label: "First paragraph",
        multiline: true,
        default: `{loggerName} just logged a vous with you on {vousDate} in incREDible.`,
      },
      { key: "linkLabel", label: "Link text", default: `Tap here` },
      {
        key: "body2",
        label: "Call to action (use {logItLink} for the link)",
        multiline: true,
        default: `{logItLink} to log this vous in your incREDible profile, too.`,
      },
      { key: "ignoreNote", label: "Reassurance", default: `Already logged it? Just ignore this email and keep smilin' :-)` },
      { key: "signOff1", label: "Sign-off line 1", default: `Ciao for now,` },
      { key: "signOff2", label: "Sign-off line 2", default: `Your REDical friends xoxo` },
    ],
    variables: [
      { token: "recipientFirstName", label: "Recipient's first name", sample: "Jordan" },
      { token: "loggerName", label: "Name of who logged it", sample: "Jamie Rivera" },
      { token: "vousDate", label: "Date of the vous (formatted)", sample: "Tue, Sep 1, 2026" },
      { token: "logItLink", label: "Link that opens the pre-filled vous form", sample: "Tap here" },
    ],
  },
  {
    id: "referred-person",
    name: "Introduction to a referred person",
    description: "Goes to someone OUTSIDE the chamber, letting them know a member will be in touch.",
    audience: "guest",
    sender: "The Pride Chamber",
    fields: [
      { key: "subject", label: "Subject line", default: `An introduction from The Pride Chamber` },
      { key: "greeting", label: "Greeting", default: `Dear {referredName}` },
      {
        key: "body1",
        label: "First paragraph",
        multiline: true,
        default: `{referrerName} from The Pride Chamber has recommended an introduction to {recipientWithCompany}.`,
      },
      {
        key: "body2",
        label: "Second paragraph",
        multiline: true,
        default: `{recipientName} will soon be in touch to discuss how you may support each other.`,
      },
      {
        key: "body3",
        label: "About paragraph (use {chamberLink} for the website link)",
        multiline: true,
        default: `Thanks for your interest in The Pride Chamber. Learn more about us at {chamberLink}.`,
      },
      { key: "signOff1", label: "Sign-off line 1", default: `Kind regards,` },
      { key: "signOff2", label: "Sign-off line 2", default: `The team at {referrerSubGroup}` },
    ],
    variables: [
      { token: "referredName", label: "Referred person's name", sample: "Alex Chen" },
      { token: "referrerName", label: "Referring member's name", sample: "Jamie Rivera" },
      { token: "recipientName", label: "Member who will make contact", sample: "Sam Taylor" },
      {
        token: "recipientWithCompany",
        label: "That member with company, e.g. 'Sam Taylor from Taylor Co'",
        sample: "Sam Taylor from Taylor Co",
      },
      { token: "referrerSubGroup", label: "Referrer's sub-group (sign-off)", sample: "RED Central" },
      { token: "chamberLink", label: "Link to thepridechamber.org", sample: "thepridechamber.org" },
    ],
  },
  {
    id: "guest-invite",
    name: "Guest invitation",
    description: "Invites a prospective guest a member has added via the invite form.",
    audience: "guest",
    sender: "The Pride Chamber",
    fields: [
      {
        key: "subject",
        label: "Subject line",
        default: `{inviterName} invited you to a Pride Chamber RED meeting`,
      },
      { key: "eyebrow", label: "Eyebrow label", default: `You're invited` },
      { key: "heading", label: "Heading", default: `{inviterName} has invited you to a RED meeting` },
      {
        key: "intro",
        label: "Intro",
        multiline: true,
        default: `Dear {guestName}, {inviterFrom} would love for you to come along as their guest to {subGroup}, part of The Pride Chamber's RED networking group.`,
      },
      {
        key: "noMeetingNote",
        label: "Shown when no meeting is picked yet",
        multiline: true,
        default: `{inviterName} will be in touch with the date and the rest of the details shortly.`,
      },
      {
        key: "aboutNote",
        label: "About RED",
        multiline: true,
        default: `RED is a friendly circle of business owners who meet to support one another and pass real business between them. Come and see what it's about — there's no pressure and no cost to visit.`,
      },
      { key: "signOff1", label: "Sign-off line 1", default: `Warm regards,` },
      { key: "signOff2", label: "Sign-off line 2", default: `The team at {subGroup}` },
    ],
    variables: [
      { token: "guestName", label: "Guest's name", sample: "Alex Chen" },
      { token: "inviterName", label: "Inviting member's name", sample: "Jamie Rivera" },
      {
        token: "inviterFrom",
        label: "Inviter with company, e.g. 'Jamie Rivera of Rivera Design'",
        sample: "Jamie Rivera of Rivera Design",
      },
      { token: "subGroup", label: "Sub-group they're invited to", sample: "RED Central" },
    ],
  },
  {
    id: "guest-registered",
    name: "Guest registration confirmation",
    description: "Confirms a guest's spot after they self-register by scanning a member's QR code.",
    audience: "guest",
    sender: "The Pride Chamber",
    fields: [
      { key: "subject", label: "Subject line", default: `You're registered as {hostName}'s guest` },
      { key: "eyebrow", label: "Eyebrow label", default: `You're registered` },
      { key: "heading", label: "Heading", default: `You're all set, {guestName}` },
      {
        key: "intro",
        label: "Intro (meeting details box follows this)",
        multiline: true,
        default: `Thanks for registering. You're confirmed as {hostName}'s guest at:`,
      },
      {
        key: "outro",
        label: "Closing paragraph",
        multiline: true,
        default: `We look forward to welcoming you. If anything changes, just let {hostName} know.`,
      },
      { key: "signOff1", label: "Sign-off line 1", default: `Warm regards,` },
      { key: "signOff2", label: "Sign-off line 2", default: `The team at {subGroup}` },
    ],
    variables: [
      { token: "guestName", label: "Guest's name", sample: "Alex Chen" },
      { token: "hostName", label: "Hosting member's name", sample: "Jamie Rivera" },
      { token: "subGroup", label: "Sub-group of the meeting", sample: "RED Central" },
    ],
  },
  {
    id: "guest-registered-host",
    name: "Guest registered (host alert)",
    description: "Tells the inviting member that their guest scanned the QR code and registered.",
    audience: "member",
    sender: "incREDible",
    fields: [
      { key: "subject", label: "Subject line", default: `{guestName} registered as your guest` },
      { key: "eyebrow", label: "Eyebrow label", default: `Guest registered` },
      { key: "heading", label: "Heading", default: `{guestWithCompany} is coming!` },
      {
        key: "intro",
        label: "Intro (meeting details box follows this)",
        multiline: true,
        default: `Hi {hostFirstName}, good news — {guestWithCompany} scanned your invite QR code and registered to attend:`,
      },
      {
        key: "outro",
        label: "Closing paragraph",
        multiline: true,
        default: `They've been added to your guest tally in incREDible. Nice work bringing someone along!`,
      },
    ],
    variables: [
      { token: "hostFirstName", label: "Host member's first name", sample: "Jordan" },
      { token: "guestName", label: "Guest's name", sample: "Alex Chen" },
      {
        token: "guestWithCompany",
        label: "Guest with company, e.g. 'Alex Chen of Chen Co'",
        sample: "Alex Chen of Chen Co",
      },
    ],
  },
  {
    id: "sync-failure",
    name: "Calendar sync failure alert",
    description: "Internal heads-up to the maintainer when the Pride Chamber calendar sync fails.",
    audience: "internal",
    sender: "incREDible — sync alert",
    fields: [
      { key: "subject", label: "Subject line", default: `Pride Chamber event sync failed` },
      {
        key: "heading",
        label: "Opening line",
        multiline: true,
        default: `A Pride Chamber calendar sync did not complete.`,
      },
      {
        key: "reassurance",
        label: "Reassurance (shown under the error)",
        multiline: true,
        default: `Members are unaffected: the reporting form is still showing the last successfully imported events. The next scheduled sync will retry automatically.`,
      },
    ],
    variables: [
      { token: "trigger", label: "What triggered the sync", sample: "cron" },
      { token: "window", label: "Date window being fetched", sample: "2026-08-13 to 2026-09-13" },
    ],
  },
]

export const EMAIL_TEMPLATE_IDS = EMAIL_TEMPLATES.map((t) => t.id)

export function getEmailTemplate(id: string): EmailTemplateMeta | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id)
}

/** The verbatim shipped copy for a template, keyed by field. */
export function defaultCopy(id: string): Record<string, string> {
  const template = getEmailTemplate(id)
  if (!template) return {}
  const out: Record<string, string> = {}
  for (const field of template.fields) out[field.key] = field.default
  return out
}

/**
 * Layers stored overrides on top of the code defaults, keeping only keys the
 * template still declares (so a removed field in a stale override is ignored).
 * The result always contains every field, so a builder can read any key safely.
 */
export function mergeCopy(id: string, overrides?: Record<string, string> | null): Record<string, string> {
  const template = getEmailTemplate(id)
  if (!template) return {}
  const out: Record<string, string> = {}
  for (const field of template.fields) {
    const override = overrides?.[field.key]
    out[field.key] = typeof override === "string" ? override : field.default
  }
  return out
}

/** Keeps only the fields that actually differ from the default, for compact storage. */
export function diffFromDefault(id: string, copy: Record<string, string>): Record<string, string> {
  const template = getEmailTemplate(id)
  if (!template) return {}
  const out: Record<string, string> = {}
  for (const field of template.fields) {
    const value = copy[field.key]
    if (typeof value === "string" && value !== field.default) out[field.key] = value
  }
  return out
}
