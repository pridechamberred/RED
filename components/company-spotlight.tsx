import Link from "next/link"
import { SOCIAL_ICONS } from "@/components/social-icons"
import { getSpotlightMember } from "@/lib/data"
import { memberSocialLinks } from "@/lib/socials"

export async function CompanySpotlight() {
  const member = await getSpotlightMember()
  if (!member) return null

  const links = memberSocialLinks(member)

  return (
    <section aria-labelledby="spotlight-heading" className="mt-10 flex flex-col gap-3">
      <h2
        id="spotlight-heading"
        className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
      >
        {"SPOTLIGHT ON "}
        <Link href={`/member/${member.id}`} className="text-foreground underline-offset-4 hover:underline">
          {member.company.toUpperCase()}
        </Link>
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-sm leading-relaxed text-pretty">
          Please give their socials some love! Follow, like and subscribe:
        </p>
        <ul className="flex flex-wrap gap-2">
          {links.map(({ platform, href }) => {
            const Icon = SOCIAL_ICONS[platform.key]
            return (
              <li key={platform.key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.company} on ${platform.label} (opens in a new tab)`}
                  title={platform.label}
                  className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Icon className="size-5" aria-hidden />
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
