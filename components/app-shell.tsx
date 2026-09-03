import type React from "react"
import { BottomNav } from "@/components/bottom-nav"

/**
 * Mobile-first page frame: content column capped for desktop, nav pinned to the
 * bottom where a thumb can reach it.
 */
export function AppShell({
  children,
  showAdmin,
}: {
  children: React.ReactNode
  showAdmin: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1 pb-20">
        <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-7">{children}</div>
      </div>
      <BottomNav showAdmin={showAdmin} />
    </div>
  )
}
