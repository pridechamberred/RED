import { Resend } from "resend"

import { mergeCopy } from "@/lib/email-templates"
import { resolveEmailCopy } from "@/lib/email-copy"

/*
 * Every email is now rendered from editable copy blocks (see
 * `lib/email-templates.ts`), which a super-admin can reword in the admin
 * editor. This file keeps everything that must NOT be editable: the layout,
 * the branding, the merge/escaping logic, and the single delivery path.
 *
 * The golden rule that keeps untrusted names safe: in the HTML build the copy
 * is escaped first, then merge values are substituted. Data values are escaped
 * where they are put into the `htmlVars` map; a couple of layout-owned values
 * (links) are intentionally raw HTML. Copy is authored only by super-admins, so
 * it is trusted, but escaping it anyway means a stray `<` can never break a
 * layout either.
 */

type ReferralEmailInput = {
  to: string
  recipientFirstName: string
  referrerName: string
  referrerCompany: string | null
  referredName: string
  // Optional since migration 009: a member may only have a phone number for
  // the person they are referring.
  referredEmail?: string | null
  referredPhone?: string | null
  referredCompany?: string | null
  details: string
}

type OfflineReferralEmailInput = {
  to: string
  recipientFirstName: string
  referrerName: string
  referredName: string
  /** ISO date (yyyy-mm-dd) the referral was actually passed on. */
  occurredOn: string
}

type ReferredPersonEmailInput = {
  to: string
  referredName: string
  referrerName: string
  referrerSubGroup: string
  recipientName: string
  recipientCompany: string | null
}

type PasswordResetEmailInput = {
  to: string
  recipientFirstName: string
  resetUrl: string
  /** How long the link stays valid, in words, e.g. "1 hour". */
  expiresIn: string
}

type VousLoggedEmailInput = {
  to: string
  recipientFirstName: string
  loggerName: string
  /** ISO date (yyyy-mm-dd) of the vous itself, not of this email. */
  vousDate: string
  logItUrl: string
}

type GuestInviteEmailInput = {
  to: string
  guestName: string
  inviterName: string
  inviterCompany: string | null
  subGroup: string
  meetingLabel: string | null
  meetingLocation: string | null
}

type GuestRegisteredGuestEmailInput = {
  to: string
  guestName: string
  hostName: string
  subGroup: string
  meetingLabel: string
  meetingLocation: string | null
}

type GuestRegisteredHostEmailInput = {
  to: string
  hostFirstName: string
  guestName: string
  guestCompany: string | null
  meetingLabel: string
  meetingLocation: string | null
}

type ScraperFailureEmailInput = {
  /** The underlying error message from the scrape attempt. */
  error: string
  /** The window that was being fetched, e.g. "2026-08-13 to 2026-09-13". */
  window: string
  /** Whether the failure came from the daily cron or an admin's manual run. */
  trigger: "cron" | "manual"
}

type Copy = Record<string, string>
type RenderedEmail = { subject: string; html: string; text: string }

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Fills an editable copy string for the HTML build: the copy is escaped, then
 * each `{token}` is replaced with its (already HTML-ready) value. Tokens
 * survive escaping because braces and letters are not escaped.
 */
function fillHtml(copy: string, vars: Copy) {
  let out = escapeHtml(copy)
  for (const key of Object.keys(vars)) out = out.split(`{${key}}`).join(vars[key])
  return out
}

/** Fills an editable copy string for the plain-text build (no escaping). */
function fillText(copy: string, vars: Copy) {
  let out = copy
  for (const key of Object.keys(vars)) out = out.split(`{${key}}`).join(vars[key])
  return out
}

// ---------------------------------------------------------------------------
// Layout primitives — the locked-in shell, headers, and block styles that copy
// is poured into. None of this is editable from the admin editor.
// ---------------------------------------------------------------------------

const BODY_STYLE =
  "margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"
const CARD_STYLE = "max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;"
const P = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a46;"
const SIGNOFF_STYLE = "margin:24px 0 0;font-size:15px;line-height:1.6;color:#4a4a46;"

function htmlShell(header: string, inner: string) {
  return `<!doctype html>
<html>
  <body style="${BODY_STYLE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${CARD_STYLE}">
      ${header}
      <tr>
        <td style="padding:28px;">
${inner}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** incREDible header, for member-facing mail. */
function incredibleHeader() {
  return `<tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">inc<span style="color:#cf2c2c;">RED</span>ible</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">The Pride Chamber&#39;s RED Group activity tracker</span>
        </td>
      </tr>`
}

/** Plain "The Pride Chamber" header used by the referred-person introduction. */
function chamberHeaderPlain() {
  return `<tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">The Pride Chamber</span>
        </td>
      </tr>`
}

/** The Pride Chamber header with the "RED networking group" subtitle, for guest mail. */
function chamberHeader() {
  return `<tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">The Pride Chamber</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">RED networking group</span>
        </td>
      </tr>`
}

function syncAlertHeader() {
  return `<tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">incREDible — sync alert</span>
        </td>
      </tr>`
}

function para(inner: string, style: string = P) {
  return `          <p style="${style}">${inner}</p>`
}

function eyebrow(inner: string, color = "#cf2c2c") {
  return `          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.06em;">${inner}</p>`
}

function heading(inner: string) {
  return `          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#17171a;">${inner}</h1>`
}

/** "Tue, Sep 1, 2026" from an ISO date, without pulling in a date library. */
function formatOccurredOn(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    // Fixed to the chamber's timezone so the date reads the same for every
    // recipient regardless of where the server runs.
    timeZone: "America/New_York",
  })
}

const CHAMBER_URL = "https://thepridechamber.org"

/**
 * The three guest emails all describe a meeting. The picker label already reads
 * "RED Central — Tue, Sep 8, 11:30 AM EDT", so it is shown as a single
 * "Meeting" line, with the venue on its own "Where" line when known.
 */
function meetingBoxHtml(meetingLabel: string, meetingLocation: string | null, e: (s: string) => string) {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#6d6d68;font-size:14px;width:84px;vertical-align:top;">${e(label)}</td>
      <td style="padding:8px 0;color:#17171a;font-size:14px;font-weight:600;vertical-align:top;">${e(value)}</td>
    </tr>`
  const rows = [row("Meeting", meetingLabel), meetingLocation ? row("Where", meetingLocation) : ""].join("")
  return `          <div style="background:#fbfbfa;border:1px solid #e6e5e1;border-radius:12px;padding:8px 18px;margin:0 0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          </div>`
}

function meetingBoxText(meetingLabel: string, meetingLocation: string | null) {
  return [`Meeting: ${meetingLabel}`, meetingLocation ? `Where:   ${meetingLocation}` : null]
    .filter((line) => line !== null)
    .join("\n")
}

// ---------------------------------------------------------------------------
// Renderers — one per template, each turning (data, resolved copy) into the
// final subject/html/text. Shared by the live send path and the editor preview.
// ---------------------------------------------------------------------------

function renderPasswordReset(input: PasswordResetEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const htmlVars: Copy = { recipientFirstName: e(input.recipientFirstName), expiresIn: e(input.expiresIn) }
  const textVars: Copy = { recipientFirstName: input.recipientFirstName, expiresIn: input.expiresIn }

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars)),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.intro, htmlVars)),
    `          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="border-radius:10px;background:#cf2c2c;">
                <a href="${e(input.resetUrl)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${fillHtml(copy.buttonLabel, htmlVars)}</a>
              </td>
            </tr>
          </table>`,
    para(fillHtml(copy.expiryNote, htmlVars), "margin:0 0 20px;font-size:13px;line-height:1.6;color:#6d6d68;"),
    `          <div style="border-left:3px solid #e6e5e1;padding:2px 0 2px 14px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#6d6d68;">${fillHtml(copy.securityNote, htmlVars)}</p>
          </div>`,
    para(
      `${fillHtml(copy.fallbackNote, htmlVars)}<br />${e(input.resetUrl)}`,
      "margin:24px 0 0;font-size:12px;line-height:1.6;color:#6d6d68;word-break:break-all;",
    ),
  ].join("\n")

  const text = [
    fillText(copy.intro, textVars),
    ``,
    input.resetUrl,
    ``,
    fillText(copy.expiryNote, textVars),
    ``,
    fillText(copy.securityNote, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(incredibleHeader(), inner), text }
}

function renderReferral(input: ReferralEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const companySuffixHtml = input.referrerCompany ? ` of ${e(input.referrerCompany)}` : ""
  const companySuffixText = input.referrerCompany ? ` of ${input.referrerCompany}` : ""
  const htmlVars: Copy = {
    recipientFirstName: e(input.recipientFirstName),
    referrerName: e(input.referrerName),
    referrerCompanySuffix: companySuffixHtml,
    referredName: e(input.referredName),
  }
  const textVars: Copy = {
    recipientFirstName: input.recipientFirstName,
    referrerName: input.referrerName,
    referrerCompanySuffix: companySuffixText,
    referredName: input.referredName,
  }

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#6d6d68;font-size:14px;width:120px;vertical-align:top;">${e(label)}</td>
      <td style="padding:8px 0;color:#17171a;font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`
  const contactRows = [
    row("Name", e(input.referredName)),
    input.referredEmail
      ? row("Email", `<a href="mailto:${e(input.referredEmail)}" style="color:#cf2c2c;">${e(input.referredEmail)}</a>`)
      : "",
    input.referredPhone
      ? row("Phone", `<a href="tel:${e(input.referredPhone)}" style="color:#cf2c2c;">${e(input.referredPhone)}</a>`)
      : "",
    input.referredCompany ? row("Company", e(input.referredCompany)) : "",
  ].join("")

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars)),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.intro, htmlVars)),
    `          <div style="background:#fbfbfa;border:1px solid #e6e5e1;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6d6d68;text-transform:uppercase;letter-spacing:0.06em;">${fillHtml(copy.contactLabel, htmlVars)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${contactRows}</table>
          </div>`,
    `          <div style="border-left:3px solid #cf2c2c;padding:2px 0 2px 14px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6d6d68;text-transform:uppercase;letter-spacing:0.06em;">${fillHtml(copy.reasonLabel, htmlVars)}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#17171a;white-space:pre-wrap;">${e(input.details)}</p>
          </div>`,
    para(fillHtml(copy.footerNote, htmlVars), "margin:24px 0 0;font-size:13px;line-height:1.6;color:#6d6d68;"),
  ].join("\n")

  const text = [
    fillText(copy.intro, textVars),
    ``,
    fillText(copy.contactLabel, textVars).toUpperCase(),
    `Name:    ${input.referredName}`,
    input.referredEmail ? `Email:   ${input.referredEmail}` : null,
    input.referredPhone ? `Phone:   ${input.referredPhone}` : null,
    input.referredCompany ? `Company: ${input.referredCompany}` : null,
    ``,
    fillText(copy.reasonLabel, textVars).toUpperCase(),
    input.details,
    ``,
    fillText(copy.footerNote, textVars),
  ]
    .filter((line) => line !== null)
    .join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(incredibleHeader(), inner), text }
}

function renderOfflineReferral(input: OfflineReferralEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const occurredOn = formatOccurredOn(input.occurredOn)
  const htmlVars: Copy = {
    recipientFirstName: e(input.recipientFirstName),
    referrerName: e(input.referrerName),
    referredName: e(input.referredName),
    occurredOn: e(occurredOn),
  }
  const textVars: Copy = {
    recipientFirstName: input.recipientFirstName,
    referrerName: input.referrerName,
    referredName: input.referredName,
    occurredOn,
  }

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars), "#6d6d68"),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.body1, htmlVars), "margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a46;"),
    para(fillHtml(copy.body2, htmlVars), "margin:0;font-size:15px;line-height:1.6;color:#4a4a46;"),
  ].join("\n")

  const text = [fillText(copy.body1, textVars), ``, fillText(copy.body2, textVars)].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(incredibleHeader(), inner), text }
}

function renderVousLogged(input: VousLoggedEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const vousDate = formatOccurredOn(input.vousDate)
  const logItLinkHtml = `<a href="${e(input.logItUrl)}" style="color:#cf2c2c;font-weight:600;">${fillHtml(copy.linkLabel, {})}</a>`
  const htmlVars: Copy = {
    recipientFirstName: e(input.recipientFirstName),
    loggerName: e(input.loggerName),
    vousDate: e(vousDate),
    logItLink: logItLinkHtml,
  }
  const textVars: Copy = {
    recipientFirstName: input.recipientFirstName,
    loggerName: input.loggerName,
    vousDate,
    logItLink: copy.linkLabel,
  }

  const inner = [
    para(fillHtml(copy.greeting, htmlVars)),
    para(fillHtml(copy.body1, htmlVars)),
    para(fillHtml(copy.body2, htmlVars)),
    para(fillHtml(copy.ignoreNote, htmlVars)),
    para(fillHtml(copy.signOff1, htmlVars), SIGNOFF_STYLE),
    para(fillHtml(copy.signOff2, htmlVars), SIGNOFF_STYLE),
  ].join("\n")

  const text = [
    fillText(copy.greeting, textVars),
    ``,
    fillText(copy.body1, textVars),
    ``,
    fillText(copy.body2, textVars),
    input.logItUrl,
    ``,
    fillText(copy.ignoreNote, textVars),
    ``,
    fillText(copy.signOff1, textVars),
    fillText(copy.signOff2, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(incredibleHeader(), inner), text }
}

function renderReferredPerson(input: ReferredPersonEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const recipientWithCompanyHtml = input.recipientCompany
    ? `${e(input.recipientName)} from ${e(input.recipientCompany)}`
    : e(input.recipientName)
  const recipientWithCompanyText = input.recipientCompany
    ? `${input.recipientName} from ${input.recipientCompany}`
    : input.recipientName
  const chamberLinkHtml = `<a href="${CHAMBER_URL}" style="color:#cf2c2c;font-weight:600;">thepridechamber.org</a>`
  const htmlVars: Copy = {
    referredName: e(input.referredName),
    referrerName: e(input.referrerName),
    recipientName: e(input.recipientName),
    recipientWithCompany: recipientWithCompanyHtml,
    referrerSubGroup: e(input.referrerSubGroup),
    chamberLink: chamberLinkHtml,
  }
  const textVars: Copy = {
    referredName: input.referredName,
    referrerName: input.referrerName,
    recipientName: input.recipientName,
    recipientWithCompany: recipientWithCompanyText,
    referrerSubGroup: input.referrerSubGroup,
    chamberLink: CHAMBER_URL,
  }

  const inner = [
    para(fillHtml(copy.greeting, htmlVars)),
    para(fillHtml(copy.body1, htmlVars)),
    para(fillHtml(copy.body2, htmlVars)),
    para(fillHtml(copy.body3, htmlVars)),
    para(`${fillHtml(copy.signOff1, htmlVars)}<br />${fillHtml(copy.signOff2, htmlVars)}`, SIGNOFF_STYLE),
  ].join("\n")

  const text = [
    fillText(copy.greeting, textVars),
    ``,
    fillText(copy.body1, textVars),
    ``,
    fillText(copy.body2, textVars),
    ``,
    fillText(copy.body3, textVars),
    ``,
    fillText(copy.signOff1, textVars),
    fillText(copy.signOff2, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(chamberHeaderPlain(), inner), text }
}

function renderGuestInvite(input: GuestInviteEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const inviterFromHtml = input.inviterCompany
    ? `${e(input.inviterName)} of ${e(input.inviterCompany)}`
    : e(input.inviterName)
  const inviterFromText = input.inviterCompany
    ? `${input.inviterName} of ${input.inviterCompany}`
    : input.inviterName
  const htmlVars: Copy = {
    guestName: e(input.guestName),
    inviterName: e(input.inviterName),
    inviterFrom: inviterFromHtml,
    subGroup: e(input.subGroup),
  }
  const textVars: Copy = {
    guestName: input.guestName,
    inviterName: input.inviterName,
    inviterFrom: inviterFromText,
    subGroup: input.subGroup,
  }

  const detailBlockHtml = input.meetingLabel
    ? meetingBoxHtml(input.meetingLabel, input.meetingLocation, e)
    : para(fillHtml(copy.noMeetingNote, htmlVars))

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars)),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.intro, htmlVars)),
    detailBlockHtml,
    para(fillHtml(copy.aboutNote, htmlVars)),
    para(`${fillHtml(copy.signOff1, htmlVars)}<br />${fillHtml(copy.signOff2, htmlVars)}`, SIGNOFF_STYLE),
  ].join("\n")

  const text = [
    fillText(copy.intro, textVars),
    ``,
    input.meetingLabel
      ? meetingBoxText(input.meetingLabel, input.meetingLocation)
      : fillText(copy.noMeetingNote, textVars),
    ``,
    fillText(copy.aboutNote, textVars),
    ``,
    fillText(copy.signOff1, textVars),
    fillText(copy.signOff2, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(chamberHeader(), inner), text }
}

function renderGuestRegistered(input: GuestRegisteredGuestEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const htmlVars: Copy = {
    guestName: e(input.guestName),
    hostName: e(input.hostName),
    subGroup: e(input.subGroup),
  }
  const textVars: Copy = { guestName: input.guestName, hostName: input.hostName, subGroup: input.subGroup }

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars)),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.intro, htmlVars)),
    meetingBoxHtml(input.meetingLabel, input.meetingLocation, e),
    para(fillHtml(copy.outro, htmlVars)),
    para(`${fillHtml(copy.signOff1, htmlVars)}<br />${fillHtml(copy.signOff2, htmlVars)}`, SIGNOFF_STYLE),
  ].join("\n")

  const text = [
    fillText(copy.intro, textVars),
    ``,
    meetingBoxText(input.meetingLabel, input.meetingLocation),
    ``,
    fillText(copy.outro, textVars),
    ``,
    fillText(copy.signOff1, textVars),
    fillText(copy.signOff2, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(chamberHeader(), inner), text }
}

function renderGuestRegisteredHost(input: GuestRegisteredHostEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const guestWithCompanyHtml = input.guestCompany
    ? `${e(input.guestName)} of ${e(input.guestCompany)}`
    : e(input.guestName)
  const guestWithCompanyText = input.guestCompany ? `${input.guestName} of ${input.guestCompany}` : input.guestName
  const htmlVars: Copy = {
    hostFirstName: e(input.hostFirstName),
    guestName: e(input.guestName),
    guestWithCompany: guestWithCompanyHtml,
  }
  const textVars: Copy = {
    hostFirstName: input.hostFirstName,
    guestName: input.guestName,
    guestWithCompany: guestWithCompanyText,
  }

  const inner = [
    eyebrow(fillHtml(copy.eyebrow, htmlVars)),
    heading(fillHtml(copy.heading, htmlVars)),
    para(fillHtml(copy.intro, htmlVars)),
    meetingBoxHtml(input.meetingLabel, input.meetingLocation, e),
    para(fillHtml(copy.outro, htmlVars)),
  ].join("\n")

  const text = [
    fillText(copy.intro, textVars),
    ``,
    meetingBoxText(input.meetingLabel, input.meetingLocation),
    ``,
    fillText(copy.outro, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(incredibleHeader(), inner), text }
}

function renderSyncFailure(input: ScraperFailureEmailInput, copy: Copy): RenderedEmail {
  const e = escapeHtml
  const htmlVars: Copy = { trigger: e(input.trigger), window: e(input.window) }
  const textVars: Copy = { trigger: input.trigger, window: input.window }

  const inner = [
    para(fillHtml(copy.heading, htmlVars)),
    para(`<strong>Trigger:</strong> ${e(input.trigger)}<br /><strong>Window:</strong> ${e(input.window)}`),
    `          <p style="margin:0 0 8px;font-size:13px;color:#6d6d68;">Error</p>
          <pre style="margin:0 0 16px;padding:12px 14px;background:#f7f7f5;border-radius:10px;font-size:13px;line-height:1.5;color:#8a2020;white-space:pre-wrap;word-break:break-word;">${e(input.error)}</pre>`,
    para(fillHtml(copy.reassurance, htmlVars)),
  ].join("\n")

  const text = [
    fillText(copy.heading, textVars),
    ``,
    `Trigger: ${input.trigger}`,
    `Window:  ${input.window}`,
    ``,
    `Error:`,
    input.error,
    ``,
    fillText(copy.reassurance, textVars),
  ].join("\n")

  return { subject: fillText(copy.subject, textVars), html: htmlShell(syncAlertHeader(), inner), text }
}

// ---------------------------------------------------------------------------
// Footer + delivery — unchanged behaviour, applied at the single chokepoint.
// ---------------------------------------------------------------------------

/**
 * Footer appended to every outgoing email, in both HTML and plain text.
 *
 * Wording is the user's verbatim copy — including "(C)" rather than "©" and the
 * curly apostrophes. Don't "tidy" it. It is deliberately NOT part of the
 * editable copy blocks: it is legal/no-reply boilerplate that must appear on
 * every email including any added later.
 */
const FOOTER_LINES = [
  "This is a real email, but this mailbox doesn\u2019t really exist. Who, me? \u{1F440}",
  "Please don\u2019t reply \u2014 your message will only confuse the cyberspace ghosts. \u{1F47B}",
] as const

const FOOTER_COPYRIGHT = "&#169; The Pride Chamber X Poolsyde 2026"

function htmlFooter() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="padding:20px 28px 4px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#6d6d68;">
            ${FOOTER_LINES[0]}<br />${FOOTER_LINES[1]}
          </p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#9a9a94;">${FOOTER_COPYRIGHT}</p>
        </td>
      </tr>
    </table>`
}

function withHtmlFooter(html: string) {
  const footer = htmlFooter()
  return html.includes("</body>") ? html.replace("</body>", `${footer}\n  </body>`) : html + footer
}

function withTextFooter(text: string) {
  return [text, ``, `---`, ...FOOTER_LINES, ``, FOOTER_COPYRIGHT].join("\n")
}

/**
 * The one sending identity for the whole app. Pinned to the verified
 * `red.poolsyde.com` domain — see git history for why this is a constant rather
 * than `process.env.REFERRAL_FROM_EMAIL`. No-reply by request.
 */
const FROM_EMAIL = "incREDible <no-reply@red.poolsyde.com>"

type DeliveryResult = { sent: boolean; reason?: "not_configured" | "rejected" | "threw" }

async function deliver(
  label: string,
  message: { to: string; subject: string; html: string; text: string },
  fallbackLog: () => void,
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.log(`[v0] RESEND_API_KEY not set — ${label} not sent.`)
    fallbackLog()
    return { sent: false, reason: "not_configured" }
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM_EMAIL,
      ...message,
      html: withHtmlFooter(message.html),
      text: withTextFooter(message.text),
    })

    if (error) {
      console.error(
        `[v0] EMAIL FAILED — Resend rejected ${label} to ${message.to} (${error.name}): ${error.message}`,
      )
      return { sent: false, reason: "rejected" }
    }
    return { sent: true }
  } catch (err) {
    console.error(
      `[v0] EMAIL FAILED — Resend threw sending ${label} to ${message.to}:`,
      err instanceof Error ? err.message : String(err),
    )
    return { sent: false, reason: "threw" }
  }
}

// ---------------------------------------------------------------------------
// Public send API — signatures unchanged. Each resolves editable copy first,
// then renders and delivers.
// ---------------------------------------------------------------------------

/** Sends the password reset link. */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("password-reset")
  const { subject, html, text } = renderPasswordReset(input, copy)
  return deliver(
    "password reset",
    { to: input.to, subject, html, text },
    // The link is a credential, so it is only ever logged on the no-provider path.
    () => console.log(`[v0] Would email ${input.to} a reset link: ${input.resetUrl}`),
  )
}

/** Sends the referral notification to the member it was passed to. */
export async function sendReferralEmail(input: ReferralEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("referral")
  const { subject, html, text } = renderReferral(input, copy)
  return deliver(
    "referral notification",
    { to: input.to, subject, html, text },
    () => {
      console.log(`[v0] Would email ${input.to} | subject: ${subject}`)
      console.log(text)
    },
  )
}

/** Confirms an offline referral to the member it was passed to. */
export async function sendOfflineReferralEmail(input: OfflineReferralEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("offline-referral")
  const { subject, html, text } = renderOfflineReferral(input, copy)
  return deliver(
    "offline referral record",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} an offline referral record for ${input.referredName}`),
  )
}

/** Sends the "someone logged a vous with you" nudge. */
export async function sendVousLoggedEmail(input: VousLoggedEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("vous-logged")
  const { subject, html, text } = renderVousLogged(input, copy)
  return deliver(
    "vous logged notification",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} that ${input.loggerName} logged a vous`),
  )
}

/** Tells the referred person that an introduction is coming. */
export async function sendReferredPersonEmail(input: ReferredPersonEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("referred-person")
  const { subject, html, text } = renderReferredPerson(input, copy)
  return deliver(
    "referred-person introduction",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} an introduction notice for ${input.recipientName}`),
  )
}

/** Tells a prospective guest that their invitation is on its way. */
export async function sendGuestInviteEmail(input: GuestInviteEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("guest-invite")
  const { subject, html, text } = renderGuestInvite(input, copy)
  return deliver(
    "guest invitation",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} a guest invitation from ${input.inviterName}`),
  )
}

/** Confirms a self-registered guest's spot. */
export async function sendGuestRegisteredEmail(input: GuestRegisteredGuestEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("guest-registered")
  const { subject, html, text } = renderGuestRegistered(input, copy)
  return deliver(
    "guest registration confirmation",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} a registration confirmation for ${input.hostName}'s guest`),
  )
}

/** Tells the inviting member that a guest registered via their QR code. */
export async function sendGuestRegisteredHostEmail(input: GuestRegisteredHostEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("guest-registered-host")
  const { subject, html, text } = renderGuestRegisteredHost(input, copy)
  return deliver(
    "guest-registered host notification",
    { to: input.to, subject, html, text },
    () => console.log(`[v0] Would email ${input.to} that ${input.guestName} registered as their guest`),
  )
}

/** Where a failed Pride Chamber sync is reported, by request. */
const SCRAPER_ALERT_EMAIL = "den@poolsyde.com"

/** Alerts the maintainer that a Pride Chamber calendar sync failed. */
export async function sendScraperFailureEmail(input: ScraperFailureEmailInput): Promise<DeliveryResult> {
  const copy = await resolveEmailCopy("sync-failure")
  const { subject, html, text } = renderSyncFailure(input, copy)
  return deliver(
    "pride chamber sync failure",
    { to: SCRAPER_ALERT_EMAIL, subject, html, text },
    () => console.log(`[v0] Would alert ${SCRAPER_ALERT_EMAIL} of a Pride Chamber sync failure: ${input.error}`),
  )
}

// ---------------------------------------------------------------------------
// Editor preview — renders a template with representative sample data and the
// footer, so the admin editor shows exactly what recipients would get.
// ---------------------------------------------------------------------------

export type EmailPreview = { subject: string; html: string; text: string }

const PREVIEW_SAMPLES = {
  "password-reset": {
    to: "member@example.com",
    recipientFirstName: "Jordan",
    resetUrl: "https://redgroup.app/auth/set-password?token=sample-token",
    expiresIn: "1 hour",
  } satisfies PasswordResetEmailInput,
  referral: {
    to: "member@example.com",
    recipientFirstName: "Jordan",
    referrerName: "Jamie Rivera",
    referrerCompany: "Rivera Design",
    referredName: "Alex Chen",
    referredEmail: "alex@chenco.com",
    referredPhone: "(555) 123-4567",
    referredCompany: "Chen Co",
    details: "Alex is opening a second location and needs a full fit-out — a great match for your joinery work.",
  } satisfies ReferralEmailInput,
  "offline-referral": {
    to: "member@example.com",
    recipientFirstName: "Jordan",
    referrerName: "Jamie Rivera",
    referredName: "Alex Chen",
    occurredOn: "2026-09-01",
  } satisfies OfflineReferralEmailInput,
  "vous-logged": {
    to: "member@example.com",
    recipientFirstName: "Jordan",
    loggerName: "Jamie Rivera",
    vousDate: "2026-09-01",
    logItUrl: "https://redgroup.app/report/vous?with=sample",
  } satisfies VousLoggedEmailInput,
  "referred-person": {
    to: "prospect@example.com",
    referredName: "Alex Chen",
    referrerName: "Jamie Rivera",
    referrerSubGroup: "RED Central",
    recipientName: "Sam Taylor",
    recipientCompany: "Taylor Co",
  } satisfies ReferredPersonEmailInput,
  "guest-invite": {
    to: "prospect@example.com",
    guestName: "Alex Chen",
    inviterName: "Jamie Rivera",
    inviterCompany: "Rivera Design",
    subGroup: "RED Central",
    meetingLabel: "RED Central — Tue, Sep 8, 11:30 AM EDT",
    meetingLocation: "The Ivy, 1 High Street",
  } satisfies GuestInviteEmailInput,
  "guest-registered": {
    to: "prospect@example.com",
    guestName: "Alex Chen",
    hostName: "Jamie Rivera",
    subGroup: "RED Central",
    meetingLabel: "RED Central — Tue, Sep 8, 11:30 AM EDT",
    meetingLocation: "The Ivy, 1 High Street",
  } satisfies GuestRegisteredGuestEmailInput,
  "guest-registered-host": {
    to: "member@example.com",
    hostFirstName: "Jordan",
    guestName: "Alex Chen",
    guestCompany: "Chen Co",
    meetingLabel: "RED Central — Tue, Sep 8, 11:30 AM EDT",
    meetingLocation: "The Ivy, 1 High Street",
  } satisfies GuestRegisteredHostEmailInput,
  "sync-failure": {
    error: "TimeoutError: navigation exceeded 30000ms while loading the calendar",
    window: "2026-08-13 to 2026-09-13",
    trigger: "cron",
  } satisfies ScraperFailureEmailInput,
} as const

/**
 * Renders a template with sample data and the given (unsaved) copy overrides,
 * for the admin editor's live preview. Uses the exact same renderers and footer
 * as the real send path, so what a super-admin sees is what recipients get.
 */
export function renderEmailPreview(id: string, overrides?: Record<string, string> | null): EmailPreview {
  const copy = mergeCopy(id, overrides)
  let rendered: RenderedEmail
  switch (id) {
    case "password-reset":
      rendered = renderPasswordReset(PREVIEW_SAMPLES["password-reset"], copy)
      break
    case "referral":
      rendered = renderReferral(PREVIEW_SAMPLES.referral, copy)
      break
    case "offline-referral":
      rendered = renderOfflineReferral(PREVIEW_SAMPLES["offline-referral"], copy)
      break
    case "vous-logged":
      rendered = renderVousLogged(PREVIEW_SAMPLES["vous-logged"], copy)
      break
    case "referred-person":
      rendered = renderReferredPerson(PREVIEW_SAMPLES["referred-person"], copy)
      break
    case "guest-invite":
      rendered = renderGuestInvite(PREVIEW_SAMPLES["guest-invite"], copy)
      break
    case "guest-registered":
      rendered = renderGuestRegistered(PREVIEW_SAMPLES["guest-registered"], copy)
      break
    case "guest-registered-host":
      rendered = renderGuestRegisteredHost(PREVIEW_SAMPLES["guest-registered-host"], copy)
      break
    case "sync-failure":
      rendered = renderSyncFailure(PREVIEW_SAMPLES["sync-failure"], copy)
      break
    default:
      throw new Error(`Unknown email template: ${id}`)
  }
  return { subject: rendered.subject, html: withHtmlFooter(rendered.html), text: withTextFooter(rendered.text) }
}
