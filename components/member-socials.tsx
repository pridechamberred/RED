import { SOCIAL_ICONS } from "@/components/social-icons"
import { memberSocialLinks, type SocialLinks } from "@/lib/socials"

export function MemberSocials({ member, firstName }: { member: SocialLinks; firstName: string }) {
  const links = memberSocialLinks(member)

  if (links.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        {"This member hasn't added their social media accounts yet."}
      </p>
    )
  }

  return (
    <section
      aria-labelledby="member-socials-heading"
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4"
    >
      <h2 id="member-socials-heading" className="text-sm font-semibold">
        Visit their socials:
      </h2>
      <ul className="flex flex-wrap gap-2">
        {links.map(({ platform, href }) => {
          const Icon = SOCIAL_ICONS[platform.key]
          return (
            <li key={platform.key}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${firstName} on ${platform.label} (opens in a new tab)`}
                title={platform.label}
                className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Icon className="size-5" aria-hidden />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
