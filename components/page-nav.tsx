"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Builds a compact page list with gaps for long runs, e.g. 1 … 4 5 6 … 12.
 * Always keeps the first and last page plus a window around the current one so
 * the control never grows wider than a phone screen.
 */
function pageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const items: (number | "gap")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push("gap")
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total - 1) items.push("gap")

  items.push(total)
  return items
}

export function PageNav({
  page,
  pageSize,
  totalItems,
  onPageChange,
  label,
}: {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  label: string
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalPages <= 1) return null

  const firstShown = (page - 1) * pageSize + 1
  const lastShown = Math.min(page * pageSize, totalItems)

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing <span className="font-semibold tabular-nums text-foreground">{firstShown}</span>–
        <span className="font-semibold tabular-nums text-foreground">{lastShown}</span> of{" "}
        <span className="font-semibold tabular-nums text-foreground">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>

        {pageItems(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground tabular-nums" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === page ? "default" : "outline"}
              size="icon"
              className="size-9 text-xs font-bold tabular-nums"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
