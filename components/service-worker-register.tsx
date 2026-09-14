"use client"

import { useEffect } from "react"

/**
 * Registers /sw.js once on the client. Rendered high in the tree (root layout)
 * so the service worker is available app-wide — which is what makes the PWA
 * installable. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    // Register after load so it never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.log("[v0] service worker registration failed:", error?.message ?? error)
      })
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
