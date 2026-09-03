"use client"

import { useId, useState, type ReactNode } from "react"
import { QrCode, PenLine } from "lucide-react"

type Mode = "qr" | "manual"

/**
 * Switches between showing a QR code and typing a guest's details in.
 *
 * QR is the default because it is the fast path — the member is usually
 * face-to-face with the person. Typing details stays available for the case
 * where someone is invited later, by phone or email, and for guests whose
 * phone camera will not scan.
 *
 * Both panels are passed in already rendered so this file stays presentational
 * and the data fetching remains on the server.
 */
export function InviteGuestTabs({ qrPanel, manualForm }: { qrPanel: ReactNode; manualForm: ReactNode }) {
  const [mode, setMode] = useState<Mode>("qr")
  const baseId = useId()

  const tabs: { value: Mode; label: string; icon: typeof QrCode }[] = [
    { value: "qr", label: "Show a QR code", icon: QrCode },
    { value: "manual", label: "Enter details", icon: PenLine },
  ]

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* A real tablist, so a screen reader announces this as two views of one
          thing rather than two unrelated buttons. */}
      <div role="tablist" aria-label="How to invite your guest" className="flex gap-1.5 rounded-2xl bg-muted p-1.5">
        {tabs.map(({ value, label, icon: Icon }) => {
          const selected = mode === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${baseId}-tab-${value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${value}`}
              onClick={() => setMode(value)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                selected
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>

      {/* Both panels stay mounted and one is hidden, so switching back to a
          part-filled manual form does not throw away what was typed. */}
      <div
        role="tabpanel"
        id={`${baseId}-panel-qr`}
        aria-labelledby={`${baseId}-tab-qr`}
        hidden={mode !== "qr"}
      >
        {qrPanel}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-manual`}
        aria-labelledby={`${baseId}-tab-manual`}
        hidden={mode !== "manual"}
      >
        {manualForm}
      </div>
    </div>
  )
}
