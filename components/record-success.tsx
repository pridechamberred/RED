import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

/**
 * The success state shown after every recorded activity: confirmation, then the
 * ways onward. No extra confirmation steps.
 *
 * The "do it again" button is optional. Some flows have no sensible repeat
 * target — a referral needs a member chosen first, so there is nowhere for it to
 * go — and a button that leads nowhere is worse than no button. Omit both props
 * and only "Back to Home" is shown.
 */
export function RecordSuccess({
  title,
  note,
  againHref,
  againLabel,
}: {
  title: string
  note?: string
  againHref?: string
  againLabel?: string
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary">
        <Check className="size-8 text-primary-foreground" aria-hidden strokeWidth={3} />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance" role="status">
          {title}
        </h1>
        {note ? (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{note}</p>
        ) : null}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {againHref && againLabel ? (
          <Button render={<Link href={againHref} />} nativeButton={false} size="lg" className="h-12 w-full text-base">
            {againLabel}
          </Button>
        ) : null}
        <Button
          render={<Link href="/" />}
          nativeButton={false}
          variant="ghost"
          size="lg"
          className="h-12 w-full text-base"
        >
          Back to Home
        </Button>
      </div>
    </div>
  )
}
