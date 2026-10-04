export const SOCIAL_PLATFORMS = [
  {
    key: "facebook",
    column: "social_facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.com", "m.facebook.com"],
    profileUrl: (handle: string) => `https://www.facebook.com/${handle}`,
    placeholder: "facebook.com/yourname",
  },
  {
    key: "instagram",
    column: "social_instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    profileUrl: (handle: string) => `https://www.instagram.com/${handle}`,
    placeholder: "@yourname",
  },
  {
    key: "linkedin",
    column: "social_linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com"],
    profileUrl: (handle: string) => `https://www.linkedin.com/in/${handle}`,
    placeholder: "linkedin.com/in/yourname",
  },
  {
    key: "tiktok",
    column: "social_tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
    profileUrl: (handle: string) => `https://www.tiktok.com/@${handle}`,
    placeholder: "@yourname",
  },
  {
    key: "x",
    column: "social_x",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    profileUrl: (handle: string) => `https://x.com/${handle}`,
    placeholder: "@yourname",
  },
  {
    key: "bluesky",
    column: "social_bluesky",
    label: "Bluesky",
    hosts: ["bsky.app"],
    profileUrl: (handle: string) => `https://bsky.app/profile/${handle}`,
    placeholder: "yourname.bsky.social",
  },
  {
    key: "youtube",
    column: "social_youtube",
    label: "YouTube",
    hosts: ["youtube.com"],
    profileUrl: (handle: string) => `https://www.youtube.com/@${handle}`,
    placeholder: "@yourchannel",
  },
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
export type SocialKey = SocialPlatform["key"]
export type SocialColumn = SocialPlatform["column"]
export type SocialLinks = Partial<Record<SocialColumn, string | null>>

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,100}$/

function hostMatches(hostname: string, hosts: readonly string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, "")
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

/**
 * Turns whatever a member typed into a safe profile URL on the platform's own
 * domain. Accepts a full URL, a URL without "https://", or a bare handle.
 *
 * Returns null for empty input, or an error for anything that isn't on the
 * platform's domain — the stored value becomes an href other members click, so
 * it must never point somewhere else (or use a non-https scheme).
 */
export function normalizeSocial(
  platform: SocialPlatform,
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const input = raw.trim()
  if (!input) return { ok: true, value: null }

  const looksLikeUrl = /^https?:\/\//i.test(input) || /^[^/@\s]+\.[a-z]{2,}\//i.test(input)
  if (looksLikeUrl || platform.hosts.some((h) => input.toLowerCase().replace(/^www\./, "").startsWith(h))) {
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
      if (!hostMatches(url.hostname, platform.hosts) || url.pathname.length <= 1) {
        return { ok: false, error: `That doesn't look like a ${platform.label} profile link.` }
      }
      url.protocol = "https:"
      url.hash = ""
      return { ok: true, value: url.toString() }
    } catch {
      return { ok: false, error: `That doesn't look like a ${platform.label} profile link.` }
    }
  }

  const handle = input.replace(/^@/, "")
  if (!HANDLE_PATTERN.test(handle)) {
    return { ok: false, error: `Enter your ${platform.label} username or profile link.` }
  }
  return { ok: true, value: platform.profileUrl(handle) }
}

/** Only links that are still valid https URLs on the platform's domain, in display order. */
export function memberSocialLinks(member: SocialLinks) {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const value = member[platform.column]
    if (!value) return []
    try {
      const url = new URL(value)
      if (url.protocol !== "https:" || !hostMatches(url.hostname, platform.hosts)) return []
      return [{ platform, href: url.toString() }]
    } catch {
      return []
    }
  })
}
