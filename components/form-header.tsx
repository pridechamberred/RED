import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export function FormHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
}: {
  title: string
  subtitle?: string
  backHref: string
  backLabel?: string
}) {
  return (
    <header className="flex flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 -ml-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
        {subtitle ? <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      </div>
    </header>
  )
}
