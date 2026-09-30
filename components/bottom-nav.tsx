"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { SVGProps } from "react"
import { CalendarCheck, House, ListChecks, ShieldCheck, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

// Standard https URL: iOS Universal Links / Android App Links hand it to the
// Facebook app (straight into the group) when installed, and fall back to the
// browser otherwise. A custom fb:// scheme would break for users without the app.
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/1707853893729456"

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M15.5 7.5H14a2.5 2.5 0 0 0-2.5 2.5v11.9" />
      <path d="M9 13h6" />
    </svg>
  )
}

const ICONS = {
  home: House,
  activity: ListChecks,
  admin: ShieldCheck,
  attendance: CalendarCheck,
  facebook: FacebookIcon,
  profile: UserRound,
} as const

type Item = { href: string; label: string; icon: keyof typeof ICONS; external?: boolean }

const itemClass =
  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors"

export function BottomNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname()

  const items: Item[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/my-activity", label: "Activity", icon: "activity" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: "admin" as const }] : []),
    ...(showAdmin ? [{ href: "/attendance", label: "Turnout", icon: "attendance" as const }] : []),
    { href: FACEBOOK_GROUP_URL, label: "Facebook", icon: "facebook", external: true },
    { href: "/profile", label: "Profile", icon: "profile" },
  ]

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <ul
        className="mx-auto flex max-w-2xl items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const content = (
            <>
              <Icon className="size-5" aria-hidden />
              <span className="leading-none">{item.label}</span>
            </>
          )

          if (item.external) {
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(itemClass, "text-muted-foreground hover:text-foreground")}
                >
                  {content}
                  <span className="sr-only">(opens Facebook group)</span>
                </a>
              </li>
            )
          }

          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  itemClass,
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {content}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
