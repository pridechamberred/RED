"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** The subset of the (non-standard) install prompt event we rely on. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export type PwaPlatform = "ios" | "android" | "desktop" | "unknown"

/** localStorage key holding the epoch-ms until which we suppress the prompt. */
const DISMISS_KEY = "incredible-pwa-install-dismissed-until"
const SUPPRESS_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

function detectPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  // iPadOS 13+ reports as "MacIntel" but has a touch screen — catch it too.
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) return "ios"
  if (/android/i.test(ua)) return "android"
  // Other Chromium-based mobile browsers behave like Android for install.
  if (/mobile/i.test(ua)) return "android"
  return "desktop"
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false
  const mm = window.matchMedia?.("(display-mode: standalone)").matches ?? false
  // iOS Safari exposes navigator.standalone instead of the media query.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return mm || iosStandalone
}

function readSuppressedUntil(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export type PwaInstall = {
  /** True once the client-only detection has run; gate rendering on this. */
  hydrated: boolean
  platform: PwaPlatform
  isIOS: boolean
  /** Running from the home screen already. */
  isStandalone: boolean
  /** appinstalled has fired (or we launched standalone). */
  installed: boolean
  /** Android captured a usable beforeinstallprompt event. */
  canInstall: boolean
  /**
   * Worth offering an install affordance at all: mobile, not already installed,
   * and either iOS (manual instructions) or Android with a captured prompt.
   */
  eligible: boolean
  /** Now is past any active "Not now" suppression window. */
  notSuppressed: boolean
  /** Fire the native Android prompt. Returns the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
  /** Remember a dismissal so we stay quiet for SUPPRESS_DAYS. */
  suppress: () => void
}

/**
 * All PWA install detection and state, kept out of the visual component.
 *
 * Every browser-specific read (navigator, matchMedia, localStorage, the
 * beforeinstallprompt event) happens in effects, and all state starts in a
 * neutral SSR-safe value, so there are no hydration mismatches.
 */
export function usePwaInstall(): PwaInstall {
  const [hydrated, setHydrated] = useState(false)
  const [platform, setPlatform] = useState<PwaPlatform>("unknown")
  const [isStandalone, setIsStandalone] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [suppressedUntil, setSuppressedUntil] = useState(0)

  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setHydrated(true)
    setPlatform(detectPlatform())
    setIsStandalone(detectStandalone())
    setInstalled(detectStandalone())
    setSuppressedUntil(readSuppressedUntil())

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's own mini-infobar; we drive the prompt from our UI instead.
      event.preventDefault()
      promptEventRef.current = event as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    const onAppInstalled = () => {
      promptEventRef.current = null
      setCanInstall(false)
      setInstalled(true)
    }

    // Reflect the user installing/uninstalling or entering standalone live.
    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)")
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches)
      if (e.matches) setInstalled(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)
    displayModeQuery?.addEventListener?.("change", onDisplayModeChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
      displayModeQuery?.removeEventListener?.("change", onDisplayModeChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    const event = promptEventRef.current
    if (!event) return "unavailable" as const
    await event.prompt()
    const { outcome } = await event.userChoice
    // The event can only be used once.
    promptEventRef.current = null
    setCanInstall(false)
    return outcome
  }, [])

  const suppress = useCallback(() => {
    const until = Date.now() + SUPPRESS_DAYS * DAY_MS
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until))
    } catch {
      // Private mode / storage disabled — worst case we ask again next visit.
    }
    setSuppressedUntil(until)
  }, [])

  const isIOS = platform === "ios"
  const eligible = hydrated && !installed && !isStandalone && (isIOS || (canInstall && platform === "android"))
  const notSuppressed = Date.now() >= suppressedUntil

  return {
    hydrated,
    platform,
    isIOS,
    isStandalone,
    installed,
    canInstall,
    eligible,
    notSuppressed,
    promptInstall,
    suppress,
  }
}
