import { initials } from "@/lib/types"

type AvatarMember = {
  first_name: string
  last_name: string
  avatar_url: string | null
}

/**
 * The three sizes the app actually uses, kept here so the circle and the text
 * inside it can never drift apart — an 80px circle with 14px initials looks
 * broken, and that is easy to do by hand at each call site.
 */
const SIZES = {
  sm: { box: "size-11", text: "text-sm" },
  md: { box: "size-12", text: "text-base" },
  lg: { box: "size-20", text: "text-2xl" },
} as const

/**
 * A member's picture, falling back to their initials.
 *
 * `aria-hidden` throughout: every place this appears already renders the
 * member's name as real text beside it, so announcing "JS" or "photo of Jane
 * Smith" too would just make screen readers repeat themselves.
 */
export function MemberAvatar({
  member,
  size = "sm",
  className = "",
}: {
  member: AvatarMember
  size?: keyof typeof SIZES
  className?: string
}) {
  const { box, text } = SIZES[size]

  if (member.avatar_url) {
    return (
      // Plain <img>: next/image is configured `unoptimized`, so it would add a
      // wrapper and no benefit. object-cover stops a non-square upload from
      // squashing — it fills the circle and crops the overflow instead.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt=""
        aria-hidden
        className={`${box} shrink-0 rounded-full border border-border object-cover ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`${box} ${text} flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground ${className}`}
    >
      {initials(member)}
    </span>
  )
}
