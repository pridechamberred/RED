import type { SVGProps } from "react"
import type { SocialKey } from "@/lib/socials"

type IconProps = SVGProps<SVGSVGElement>

function Outline({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export function FacebookIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M15.5 7.5H14a2.5 2.5 0 0 0-2.5 2.5v11.9" />
      <path d="M9 13h6" />
    </Outline>
  )
}

export function InstagramIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </Outline>
  )
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M8 11v5" />
      <path d="M8 8v.01" />
      <path d="M12 16v-5" />
      <path d="M16 16v-3a2 2 0 0 0-4 0" />
    </Outline>
  )
}

export function TikTokIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M21 7.917v4.034a9.948 9.948 0 0 1-5-1.951v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2V3h4.083A6.005 6.005 0 0 0 21 7.917z" />
    </Outline>
  )
}

export function XIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M4 4l11.733 16H20L8.267 4z" />
      <path d="M4 20l6.768-6.768m2.46-2.46L20 4" />
    </Outline>
  )
}

export function BlueskyIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M6.335 5.144C4.681 3.945 2 3.017 2 5.97c0 .59.35 4.953.556 5.661.713 2.463 3.13 2.75 5.444 2.45-4.045.6-5.074 3.114-2.85 5.48 4.03 4.288 5.796-1.183 6.322-3.022.526 1.839 1.663 7.31 6.322 3.022 2.104-2.178 1.395-4.88-2.85-5.48 2.314.3 4.731.013 5.444-2.45.206-.708.556-5.07.556-5.661 0-2.953-2.68-2.025-4.335-.826-2.293 1.662-4.76 5.048-5.665 6.856-.905-1.808-3.372-5.194-5.665-6.856z" />
    </Outline>
  )
}

export const SOCIAL_ICONS: Record<SocialKey, (props: IconProps) => React.JSX.Element> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  bluesky: BlueskyIcon,
}
