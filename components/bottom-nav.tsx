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
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
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
