"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cancelVous } from "@/app/vous/actions"
import { Loader2 } from "lucide-react"

/**
 * A quiet, two-tap cancel. The first tap arms it (so a stray tap on a phone
 * doesn't cancel a real arrangement), the second commits.
 */
export function CancelVousButton({ id, label = "Cancel this Vous" }: { id: string; label?: string }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    setPending(true)
    setError(null)
    const form = new FormData()
    form.set("id", id)
    const result = await cancelVous(form)
    if (result.ok) {
      router.refresh()
      return
    }
    setError(result.error)
    setPending(false)
    setArmed(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {armed ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Yes, cancel it
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            disabled={pending}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
        >
          {label}
        </button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
