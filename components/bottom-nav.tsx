"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, ListChecks, ShieldCheck, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS = { home: House, activity: ListChecks, admin: ShieldCheck, profile: UserRound } as const

type Item = { href: string; label: string; icon: keyof typeof ICONS }

export function BottomNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname()

  const items: Item[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/my-activity", label: "My Activity", icon: "activity" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: "admin" as const }] : []),
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
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = ICONS[item.icon]
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
