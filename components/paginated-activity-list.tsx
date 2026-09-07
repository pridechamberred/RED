"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityList } from "@/components/activity-list"
import { Button } from "@/components/ui/button"
import type { ActivityRow } from "@/lib/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

/** Records shown per page before spilling into the next page. */
const PAGE_SIZE = 30

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

export function PaginatedActivityList({
  rows,
  showMemberName = false,
  emptyMessage = "Nothing recorded yet.",
}: {
  rows: ActivityRow[]
  showMemberName?: boolean
  emptyMessage?: string
}) {
  const [page, setPage] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  // Filters (admin) can shrink the list under the current page, and clearing
  // them should drop the reader back to the newest records. Resetting to page 1
  // whenever the row set changes keeps the view from stranding on an empty page.
  useEffect(() => {
    setPage(1)
  }, [rows])

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  function goTo(next: number) {
    setPage(next)
    // Jump back to the top of the feed so the next page starts at its first
    // record rather than wherever the previous page was scrolled to.
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  if (rows.length === 0) {
    return <ActivityList rows={rows} showMemberName={showMemberName} emptyMessage={emptyMessage} />
  }

  const firstShown = (page - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(page * PAGE_SIZE, rows.length)

  return (
    <div className="flex flex-col gap-4">
      <div ref={topRef} className="scroll-mt-4" />

      <ActivityList rows={pageRows} showMemberName={showMemberName} emptyMessage={emptyMessage} />

      {totalPages > 1 ? (
        <nav
          aria-label="Activity pages"
          className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing <span className="font-semibold tabular-nums text-foreground">{firstShown}</span>–
            <span className="font-semibold tabular-nums text-foreground">{lastShown}</span> of{" "}
            <span className="font-semibold tabular-nums text-foreground">{rows.length}</span>
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => goTo(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>

            {pageItems(page, totalPages).map((item, i) =>
              item === "gap" ? (
                <span
                  key={`gap-${i}`}
                  className="px-1 text-sm text-muted-foreground tabular-nums"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? "default" : "outline"}
                  size="icon"
                  className="size-9 text-xs font-bold tabular-nums"
                  onClick={() => goTo(item)}
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
              onClick={() => goTo(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}
