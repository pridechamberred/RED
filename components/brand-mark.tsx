import { cn } from "@/lib/utils"

export const BRAND_NAME = "incREDible"
export const BRAND_TAGLINE = "The Pride Chamber's RED Group activity tracker"

/**
 * The incREDible wordmark — the single signature element of the interface.
 *
 * The whole idea is that RED is already hiding inside "incredible", so colour
 * is what reveals it. Everything stays one weight and one size so the word
 * still reads as a single word; only the caps and the red do the talking.
 */
export function BrandMark({
  className,
  size = "md",
  withTagline = false,
}: {
  className?: string
  size?: "sm" | "md" | "lg"
  withTagline?: boolean
}) {
  const scale = {
    sm: { word: "text-base", tagline: "text-xs" },
    md: { word: "text-xl", tagline: "text-xs" },
    lg: { word: "text-3xl", tagline: "text-sm" },
  }[size]

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span
        aria-label={BRAND_NAME}
        className={cn("font-bold leading-none tracking-tight text-foreground", scale.word)}
      >
        inc<span className="text-primary">RED</span>ible
      </span>
      {withTagline && (
        <span className={cn("leading-relaxed text-muted-foreground", scale.tagline)}>{BRAND_TAGLINE}</span>
      )}
    </span>
  )
}
