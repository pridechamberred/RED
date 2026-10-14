"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityList } from "@/components/activity-list"
import { PageNav } from "@/components/page-nav"
import type { ActivityRow } from "@/lib/types"

/** Records shown per page before spilling into the next page. */
const PAGE_SIZE = 30

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

  return (
    <div className="flex flex-col gap-4">
      <div ref={topRef} className="scroll-mt-4" />

      <ActivityList rows={pageRows} showMemberName={showMemberName} emptyMessage={emptyMessage} />

      <PageNav page={page} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={goTo} label="Activity pages" />
    </div>
  )
}
