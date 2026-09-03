"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download, Share2 } from "lucide-react"

/**
 * The member's personal QR code, plus the ways they might want to pass it on.
 *
 * The whole point is speed: a member standing in front of someone they just met
 * should be able to get to a scannable code in two taps and no waiting. So the
 * SVG is rendered on the server and inlined here rather than drawn in the
 * browser — there is no loading state to sit through.
 */
export function InviteQrPanel({
  qrSvg,
  inviteUrl,
  memberName,
}: {
  /** Server-generated QR markup, or null if generation failed. */
  qrSvg: string | null
  inviteUrl: string
  memberName: string
}) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Checked after mount, not during render: `navigator.share` does not exist on
  // the server, and branching on it while rendering would make the server and
  // client markup disagree.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  // A pending timer that fires after unmount would set state on a dead
  // component, so it is cleared on the way out.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked without a secure context or user gesture in some
      // browsers. Selecting the visible link by hand still works, so this is
      // not worth an error banner.
      console.log("[v0] clipboard write refused")
    }
  }

  async function onShare() {
    try {
      await navigator.share({
        title: "Join me at a RED Group meeting",
        text: `${memberName} has invited you to a RED Group meeting. Pick a date that suits you:`,
        url: inviteUrl,
      })
    } catch {
      // Dismissing the share sheet rejects the promise; that is a normal
      // outcome and not something to report.
    }
  }

  function onDownload() {
    if (!qrSvg) return

    const blob = new Blob([qrSvg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `red-invite-${memberName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`
    link.click()
    // Revoked on the next tick — doing it synchronously can cancel the download
    // in some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-card px-5 py-7 text-center">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-balance">Show this to your guest</h2>
          <p className="mx-auto max-w-[26rem] text-sm leading-relaxed text-muted-foreground text-pretty">
            They scan it with their phone camera, pick a meeting, and you get the credit automatically.
          </p>
        </div>

        {qrSvg ? (
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            {/* Inlined so the code paints with the page. The markup comes from
                the qrcode library encoding a URL we built ourselves — never
                from anything a user typed. */}
            <div
              className="size-[15rem] [&>svg]:size-full sm:size-[17rem]"
              role="img"
              aria-label={`QR code linking to ${memberName}'s personal RED guest invitation page`}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-muted/40 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
            The QR code couldn&apos;t be drawn just now. Your link below still works — copy or share it instead.
          </p>
        )}

        <p className="font-mono text-xs leading-relaxed break-all text-muted-foreground">{inviteUrl}</p>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={onCopy}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Link copied" : "Copy my link"}
        </button>

        {canShare ? (
          <button
            type="button"
            onClick={onShare}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold transition-colors hover:bg-accent/60"
          >
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
        ) : null}

        {qrSvg ? (
          <button
            type="button"
            onClick={onDownload}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold transition-colors hover:bg-accent/60"
          >
            <Download className="size-4" aria-hidden />
            <span className="sm:sr-only">Save QR code</span>
          </button>
        ) : null}
      </div>

      <p className="text-center text-xs leading-relaxed text-muted-foreground text-pretty">
        This is your permanent code — it never expires, so screenshot it or print it on a card.
      </p>
    </section>
  )
}
