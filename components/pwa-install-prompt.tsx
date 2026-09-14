"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { ArrowDownToLine, Share, SquarePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePwaInstall } from "@/lib/use-pwa-install"
import { cn } from "@/lib/utils"

const OPEN_DELAY_MS = 2500
const ANIM_MS = 300

/**
 * The login-screen "Install incREDible" experience.
 *
 * All platform/eligibility logic lives in usePwaInstall; this component only
 * decides when the sheet is visible and renders the right content:
 *   - Android with a captured prompt -> a one-tap "Install App" button.
 *   - iOS -> Share > Add to Home Screen instructions (no programmatic install).
 * Nothing renders on desktop, when already installed, or in standalone mode.
 *
 * It never blocks login: it is a bottom sheet layered above the page that is
 * always dismissable, plus a subtle trigger so the user can reopen it.
 */
export function PWAInstallPrompt() {
  const pwa = usePwaInstall()
  const [mounted, setMounted] = useState(false) // in the DOM (for exit anim)
  const [open, setOpen] = useState(false) // animated-in state
  const autoOpenedRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()
  const descId = useId()

  const openSheet = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setMounted(true)
    // Next frame so the enter transition runs from the off-screen state.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
  }, [])

  const closeSheet = useCallback(() => {
    setOpen(false)
    closeTimer.current = setTimeout(() => {
      setMounted(false)
      triggerRef.current?.focus()
    }, ANIM_MS)
  }, [])

  const dismiss = useCallback(() => {
    pwa.suppress()
    closeSheet()
  }, [pwa, closeSheet])

  const install = useCallback(async () => {
    await pwa.promptInstall()
    // Whatever the outcome, stop offering for a while; if it was accepted the
    // appinstalled event also flips eligibility off entirely.
    pwa.suppress()
    closeSheet()
  }, [pwa, closeSheet])

  // Auto-open once, shortly after load, if we haven't recently been dismissed.
  useEffect(() => {
    if (!pwa.eligible || !pwa.notSuppressed || autoOpenedRef.current) return
    const t = setTimeout(() => {
      autoOpenedRef.current = true
      openSheet()
    }, OPEN_DELAY_MS)
    return () => clearTimeout(t)
  }, [pwa.eligible, pwa.notSuppressed, openSheet])

  // Escape to dismiss, focus into the panel, trap Tab, and lock body scroll.
  useEffect(() => {
    if (!mounted) return

    const previousActive = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Move focus into the sheet.
    const focusTimer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        dismiss()
        return
      }
      if (e.key !== "Tab") return
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled"))
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      clearTimeout(focusTimer)
      if (!panelRef.current) previousActive?.focus?.()
    }
  }, [mounted, dismiss])

  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), [])

  if (!pwa.hydrated || !pwa.eligible) return null

  return (
    <>
      {/* Subtle, always-available way to (re)open the instructions. */}
      <div className="mt-6 flex justify-center">
        <button
          ref={triggerRef}
          type="button"
          onClick={openSheet}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDownToLine className="size-4" aria-hidden />
          Install incREDible
        </button>
      </div>

      {mounted ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={dismiss}
            className={cn(
              "absolute inset-0 h-full w-full cursor-default bg-foreground/40 transition-opacity duration-300",
              open ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Bottom sheet */}
          <div
            ref={panelRef}
            className={cn(
              "absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-border bg-card p-6 pb-8 shadow-2xl transition-transform duration-300 ease-out",
              "sm:bottom-6 sm:rounded-3xl",
              open ? "translate-y-0" : "translate-y-full",
            )}
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-border" aria-hidden />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden />
            </button>

            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary shadow-sm">
                <span className="text-lg font-bold leading-none tracking-tight text-primary-foreground">RED</span>
              </span>
              <div className="flex flex-col gap-1 pt-0.5">
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-balance">
                  Install incREDible
                </h2>
                <p id={descId} className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {pwa.isIOS
                    ? "Add incREDible to your iPhone Home Screen for quick, app-like access."
                    : "Add incREDible to your home screen for quick access."}
                </p>
              </div>
            </div>

            {pwa.isIOS ? (
              <ol className="mt-6 flex flex-col gap-3" aria-label="Installation steps">
                <InstructionStep index={1} icon={<Share className="size-5 text-primary" aria-hidden />}>
                  Tap the <span className="font-semibold text-foreground">Share</span> button in Safari&apos;s toolbar.
                </InstructionStep>
                <InstructionStep index={2} icon={<SquarePlus className="size-5 text-primary" aria-hidden />}>
                  Scroll down and tap <span className="font-semibold text-foreground">Add to Home Screen</span>.
                </InstructionStep>
                <InstructionStep
                  index={3}
                  icon={<span className="text-sm font-bold text-primary" aria-hidden>Add</span>}
                >
                  Tap <span className="font-semibold text-foreground">Add</span> in the top corner to finish.
                </InstructionStep>
              </ol>
            ) : null}

            <div className="mt-7 flex flex-col gap-2.5">
              {pwa.isIOS ? (
                <Button type="button" size="lg" className="h-12 w-full text-base" onClick={dismiss}>
                  Got it
                </Button>
              ) : (
                <Button type="button" size="lg" className="h-12 w-full text-base" onClick={install}>
                  <ArrowDownToLine className="size-5" aria-hidden />
                  Install App
                </Button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="mx-auto rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function InstructionStep({
  index,
  icon,
  children,
}: {
  index: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/60 px-3.5 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-muted-foreground">
        {index}
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">{icon}</span>
      <span className="text-sm leading-snug text-muted-foreground text-pretty">{children}</span>
    </li>
  )
}
