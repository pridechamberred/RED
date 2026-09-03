import { Resend } from "resend"

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

/**
 * An offline referral — one already passed in person or by phone — carries no
 * contact details or notes, because the recipient already has them. So this
 * email confirms a record rather than delivering anything.
 */
type OfflineReferralEmailInput = {
  to: string
  recipientFirstName: string
  referrerName: string
  referredName: string
  /** ISO date (yyyy-mm-dd) the referral was actually passed on. */
  occurredOn: string
}

/**
 * The only email in the app that goes to someone OUTSIDE the chamber: the
 * person being referred, when their referrer explicitly opts in.
 *
 * Consequences of that, which the wording is built around:
 * - It names the member who will make contact, and their company, so the
 *   follow-up call is expected rather than cold.
 * - It deliberately carries NO contact details for anyone — not the referred
 *   person's own, and no direct line for the member. The member reaches out;
 *   this email does not hand an outsider anyone's details.
 * - It is signed by the *referrer's* sub-group, since the referrer is the
 *   recipient's only real connection to the chamber.
 */
type ReferredPersonEmailInput = {
  to: string
  /** The referred person's name, exactly as the member typed it. */
  referredName: string
  /** Who made the recommendation. */
  referrerName: string
  /** The referrer's sub-group, used for the sign-off. */
  referrerSubGroup: string
  /** The member who will be in touch. */
  recipientName: string
  /** Their company. Null when it isn't on their profile. */
  recipientCompany: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildHtml(input: ReferralEmailInput) {
  const e = escapeHtml
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

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">inc<span style="color:#cf2c2c;">RED</span>ible</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">The Pride Chamber&#39;s RED Group activity tracker</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#cf2c2c;text-transform:uppercase;letter-spacing:0.06em;">New referral</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#17171a;">
            ${e(input.referrerName)} has referred a great contact to you
          </h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a46;">
            Hi ${e(input.recipientFirstName)}, this is a referral from your fellow RED member
            <strong>${e(input.referrerName)}</strong>${input.referrerCompany ? ` of ${e(input.referrerCompany)}` : ""}.
          </p>

          <div style="background:#fbfbfa;border:1px solid #e6e5e1;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6d6d68;text-transform:uppercase;letter-spacing:0.06em;">Who to contact</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${contactRows}</table>
          </div>

          <div style="border-left:3px solid #cf2c2c;padding:2px 0 2px 14px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6d6d68;text-transform:uppercase;letter-spacing:0.06em;">Why they're being referred</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#17171a;white-space:pre-wrap;">${e(input.details)}</p>
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6d6d68;">
            Reach out soon while the introduction is fresh. When closed business results from it, record it in incREDible as a Done Deal.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildText(input: ReferralEmailInput) {
  return [
    `NEW REFERRAL — incREDible`,
    ``,
    `Hi ${input.recipientFirstName},`,
    ``,
    `${input.referrerName}${input.referrerCompany ? ` of ${input.referrerCompany}` : ""}, a fellow RED group member, has referred someone to you.`,
    ``,
    `WHO TO CONTACT`,
    `Name:    ${input.referredName}`,
    input.referredEmail ? `Email:   ${input.referredEmail}` : null,
    input.referredPhone ? `Phone:   ${input.referredPhone}` : null,
    input.referredCompany ? `Company: ${input.referredCompany}` : null,
    ``,
    `WHY THEY'RE BEING REFERRED`,
    input.details,
    ``,
    `Reach out soon while the introduction is fresh. When closed results from it, record it in incREDible as a Done Deal.`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

type PasswordResetEmailInput = {
  to: string
  recipientFirstName: string
  resetUrl: string
  /** How long the link stays valid, in words, e.g. "1 hour". */
  expiresIn: string
}

function buildResetHtml(input: PasswordResetEmailInput) {
  const e = escapeHtml

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">inc<span style="color:#cf2c2c;">RED</span>ible</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">The Pride Chamber&#39;s RED Group activity tracker</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#cf2c2c;text-transform:uppercase;letter-spacing:0.06em;">Password reset</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#17171a;">Reset your incREDible password</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a46;">
            Hi ${e(input.recipientFirstName)}, we received a request to reset your password. Click the button below to
            choose a new one.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="border-radius:10px;background:#cf2c2c;">
                <a href="${e(input.resetUrl)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Choose a new password</a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6d6d68;">
            This link expires in ${e(input.expiresIn)} and can only be used once.
          </p>

          <div style="border-left:3px solid #e6e5e1;padding:2px 0 2px 14px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#6d6d68;">
              If you didn&#39;t ask for this, you can safely ignore this email — your password will not change until you
              use the link above.
            </p>
          </div>

          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6d6d68;word-break:break-all;">
            If the button doesn&#39;t work, paste this into your browser:<br />${e(input.resetUrl)}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildResetText(input: PasswordResetEmailInput) {
  return [
    `RESET YOUR PASSWORD — incREDible`,
    ``,
    `Hi ${input.recipientFirstName},`,
    ``,
    `We received a request to reset your incREDible password. Open the link below to choose a new one:`,
    ``,
    input.resetUrl,
    ``,
    `This link expires in ${input.expiresIn} and can only be used once.`,
    ``,
    `If you didn't ask for this, you can safely ignore this email — your password will not change until you use the link above.`,
  ].join("\n")
}

/**
 * Footer appended to every outgoing email, in both HTML and plain text.
 *
 * Applied centrally in `deliver()` rather than pasted into each template, so
 * any email added later inherits it without anyone remembering to.
 *
 * Wording is the user's verbatim copy — including "(C)" rather than "©" and the
 * curly apostrophes. Don't "tidy" it.
 */
const FOOTER_LINES = [
  "This is a real email, but this mailbox doesn\u2019t really exist. Who, me? \u{1F440}",
  "Please don\u2019t reply \u2014 your message will only confuse the cyberspace ghosts. \u{1F47B}",
] as const

const FOOTER_COPYRIGHT = "&#169; The Pride Chamber X Poolsyde 2026"

/**
 * Sits below the white card on the page background, which is the conventional
 * spot for email small print. Uses a table and inline styles like the rest of
 * the templates, because Outlook ignores much else.
 */
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

/**
 * Injected before `</body>` so the footer lands after the card rather than
 * inside it. Falls back to appending if a future template omits the tag, so a
 * malformed template loses the layout but never the notice itself.
 */
function withHtmlFooter(html: string) {
  const footer = htmlFooter()
  return html.includes("</body>") ? html.replace("</body>", `${footer}\n  </body>`) : html + footer
}

function withTextFooter(text: string) {
  return [text, ``, `---`, ...FOOTER_LINES, ``, FOOTER_COPYRIGHT].join("\n")
}

/**
 * The one sending identity for the whole app.
 *
 * Deliberately a constant rather than `process.env.REFERRAL_FROM_EMAIL`. That
 * variable was set to an address on `thepridechamber.org`, which is NOT a
 * verified domain in this Resend account, so Resend rejected every send with
 * `403 "The thepridechamber.org domain is not verified"` — silently breaking
 * referral emails since they were built, and password resets on day one.
 * `red.poolsyde.com` is the verified domain, so the sender is pinned here where
 * it is reviewed with the code instead of drifting per environment.
 *
 * A no-reply mailbox by request. Nothing in the app reads replies, so
 * `replyTo` is deliberately never set — a reply bounces rather than vanishing
 * into an unwatched inbox.
 *
 * To move to the chamber's own domain: verify it in Resend (DKIM/SPF), then
 * change this one line.
 */
const FROM_EMAIL = "incREDible <no-reply@red.poolsyde.com>"

type DeliveryResult = { sent: boolean; reason?: "not_configured" | "rejected" | "threw" }

/**
 * Single delivery path for every email the app sends, so a provider problem
 * surfaces identically everywhere instead of each caller inventing its own
 * (and quieter) handling.
 *
 * `label` names the email in logs; `fallbackLog` prints the content when no
 * provider is configured, keeping local development workable.
 */
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
      // Footer applied here, at the single chokepoint, so every email carries
      // the no-reply notice — including any added later.
      html: withHtmlFooter(message.html),
      text: withTextFooter(message.text),
    })

    if (error) {
      // Loud and specific: an unverified sending domain, a suspended key or a
      // rate limit all land here, and each reads as a normal no-op unless the
      // provider's own wording is preserved.
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

/**
 * Sends the password reset link.
 *
 * Delivered through Resend rather than Supabase's built-in mailer: the default
 * Supabase SMTP is rate-limited to a couple of messages an hour project-wide,
 * which cannot serve a 40-member chamber, and it would arrive unbranded.
 */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<DeliveryResult> {
  return deliver(
    "password reset",
    {
      to: input.to,
      subject: "Reset your incREDible password",
      html: buildResetHtml(input),
      text: buildResetText(input),
    },
    // The link is a credential, so it is only ever logged on the
    // no-provider path.
    () => console.log(`[v0] Would email ${input.to} a reset link: ${input.resetUrl}`),
  )
}

/** "Tue, 1 Sep 2026" from an ISO date, without pulling in a date library. */
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

function buildOfflineHtml(input: OfflineReferralEmailInput) {
  const e = escapeHtml
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">inc<span style="color:#cf2c2c;">RED</span>ible</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">The Pride Chamber&#39;s RED Group activity tracker</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6d6d68;text-transform:uppercase;letter-spacing:0.06em;">Logged for the record</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#17171a;">
            ${e(input.referrerName)} logged a referral to you
          </h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a46;">
            Hi ${e(input.recipientFirstName)}, no action needed &mdash; this is just a note for your records.
            <strong>${e(input.referrerName)}</strong> has recorded that they passed you a referral for
            <strong>${e(input.referredName)}</strong> on ${e(formatOccurredOn(input.occurredOn))}.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4a46;">
            Because this one was passed on in person, there are no contact details here &mdash; you should
            already have them. If business comes of it, record it in incREDible as a Done Deal.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildOfflineText(input: OfflineReferralEmailInput) {
  return [
    `REFERRAL LOGGED — incREDible`,
    ``,
    `Hi ${input.recipientFirstName},`,
    ``,
    `No action needed — this is just a note for your records.`,
    ``,
    `${input.referrerName} has recorded that they passed you a referral for ${input.referredName} on ${formatOccurredOn(input.occurredOn)}.`,
    ``,
    `Because this one was passed on in person, there are no contact details here — you should already have them.`,
    ``,
    `If business comes of it, record it in incREDible as a Done Deal.`,
  ].join("\n")
}

/**
 * Confirms an offline referral to the member it was passed to.
 *
 * Deliberately quieter than `sendReferralEmail`: it opens with "no action
 * needed", drops the red accent label, and carries no contact block or call to
 * action, because the recipient has already had the conversation. Treating it
 * like a new referral would send them chasing a lead they already own.
 */
export async function sendOfflineReferralEmail(input: OfflineReferralEmailInput): Promise<DeliveryResult> {
  return deliver(
    "offline referral record",
    {
      to: input.to,
      subject: `Referral logged: ${input.referredName}`,
      html: buildOfflineHtml(input),
      text: buildOfflineText(input),
    },
    () => console.log(`[v0] Would email ${input.to} an offline referral record for ${input.referredName}`),
  )
}

/**
 * Tells a member that someone logged a vous with them, and offers to log the
 * matching one from their side.
 *
 * A vous is inherently mutual but recorded one-sidedly, so only the person who
 * remembered to log it gets the credit. This email is the nudge that closes
 * that gap — hence the prefilled link rather than a generic "open the app".
 */
type VousLoggedEmailInput = {
  to: string
  /** The member being told — the one who was vous'd with. */
  recipientFirstName: string
  /** Who logged it. */
  loggerName: string
  /** ISO date (yyyy-mm-dd) of the vous itself, not of this email. */
  vousDate: string
  /**
   * Absolute link that opens the vous form prefilled with the logger, so the
   * recipient only has to confirm. Built by the caller, which is the only place
   * that knows this deployment's own origin.
   */
  logItUrl: string
}

function buildVousLoggedHtml(input: VousLoggedEmailInput) {
  const e = escapeHtml
  const p = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a46;"
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">inc<span style="color:#cf2c2c;">RED</span>ible</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#6d6d68;">The Pride Chamber&#39;s RED Group activity tracker</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="${p}">Hey ${e(input.recipientFirstName)},</p>
          <p style="${p}">
            <strong>${e(input.loggerName)}</strong> just logged a vous with you on
            ${e(formatOccurredOn(input.vousDate))} in incREDible.
          </p>
          <p style="${p}">
            <a href="${e(input.logItUrl)}" style="color:#cf2c2c;font-weight:600;">Tap here</a>
            to log this vous in your incREDible profile, too.
          </p>
          <p style="${p}">Already logged it? Just ignore this email and keep smilin&#39; :-)</p>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#4a4a46;">Ciao for now,</p>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#4a4a46;">Your REDical friends xoxo</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildVousLoggedText(input: VousLoggedEmailInput) {
  return [
    `Hey ${input.recipientFirstName},`,
    ``,
    `${input.loggerName} just logged a vous with you on ${formatOccurredOn(input.vousDate)} in incREDible.`,
    ``,
    `Log this vous in your incREDible profile, too:`,
    input.logItUrl,
    ``,
    `Already logged it? Just ignore this email and keep smilin' :-)`,
    ``,
    `Ciao for now,`,
    `Your REDical friends`,
  ].join("\n")
}

/**
 * Sends the "someone logged a vous with you" nudge.
 *
 * The vous is already saved when this runs, so a failure here never blocks the
 * member who logged it — `deliver` logs it loudly instead.
 */
export async function sendVousLoggedEmail(input: VousLoggedEmailInput): Promise<DeliveryResult> {
  return deliver(
    "vous logged notification",
    {
      to: input.to,
      subject: `${input.loggerName} logged a vous with you`,
      html: buildVousLoggedHtml(input),
      text: buildVousLoggedText(input),
    },
    () => console.log(`[v0] Would email ${input.to} that ${input.loggerName} logged a vous`),
  )
}

const CHAMBER_URL = "https://thepridechamber.org"

/**
 * "Jane Smith from Acme Ltd" — or just "Jane Smith" when no company is on the
 * profile, so the sentence never reads "... to Jane Smith from null".
 */
function nameWithCompany(name: string, company: string | null, e: (s: string) => string) {
  return company ? `${e(name)} from ${e(company)}` : e(name)
}

function buildReferredPersonHtml(input: ReferredPersonEmailInput) {
  const e = escapeHtml
  const p = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a46;"
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f2f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e5e1;">
          <span style="font-weight:700;font-size:18px;color:#17171a;letter-spacing:-0.02em;">The Pride Chamber</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="${p}">Dear ${e(input.referredName)}</p>
          <p style="${p}">
            <strong>${e(input.referrerName)}</strong> from The Pride Chamber has recommended an introduction to
            <strong>${nameWithCompany(input.recipientName, input.recipientCompany, e)}</strong>.
          </p>
          <p style="${p}">
            ${e(input.recipientName)} will soon be in touch to discuss how you may support each other.
          </p>
          <p style="${p}">
            Thanks for your interest in The Pride Chamber. Learn more about us at
            <a href="${CHAMBER_URL}" style="color:#cf2c2c;font-weight:600;">thepridechamber.org</a>.
          </p>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#4a4a46;">
            Kind regards,<br />
            The team at ${e(input.referrerSubGroup)}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildReferredPersonText(input: ReferredPersonEmailInput) {
  const who = input.recipientCompany
    ? `${input.recipientName} from ${input.recipientCompany}`
    : input.recipientName
  return [
    `Dear ${input.referredName}`,
    ``,
    `${input.referrerName} from The Pride Chamber has recommended an introduction to ${who}.`,
    ``,
    `${input.recipientName} will soon be in touch to discuss how you may support each other.`,
    ``,
    `Thanks for your interest in The Pride Chamber. Learn more about us at ${CHAMBER_URL}`,
    ``,
    `Kind regards,`,
    `The team at ${input.referrerSubGroup}`,
  ].join("\n")
}

/**
 * Tells the referred person that an introduction is coming.
 *
 * Only ever called when the referrer explicitly opted in on the form — this is
 * an outsider's inbox, so it must never fire from a default.
 */
export async function sendReferredPersonEmail(input: ReferredPersonEmailInput): Promise<DeliveryResult> {
  return deliver(
    "referred-person introduction",
    {
      to: input.to,
      subject: `An introduction from The Pride Chamber`,
      html: buildReferredPersonHtml(input),
      text: buildReferredPersonText(input),
    },
    () => console.log(`[v0] Would email ${input.to} an introduction notice for ${input.recipientName}`),
  )
}

/**
 * Sends the referral notification. The referral itself is already saved by the
 * time this runs, so a failure here never blocks the member — but it is logged
 * loudly by `deliver` rather than passing for normal operation.
 */
export async function sendReferralEmail(input: ReferralEmailInput): Promise<DeliveryResult> {
  const subject = `Referral from ${input.referrerName}: ${input.referredName}`

  return deliver(
    "referral notification",
    { to: input.to, subject, html: buildHtml(input), text: buildText(input) },
    () => {
      console.log(`[v0] Would email ${input.to} | subject: ${subject}`)
      console.log(buildText(input))
    },
  )
}
