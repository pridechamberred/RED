"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { PageNav } from "@/components/page-nav"
import { formatSubGroups, memberName } from "@/lib/types"
import { ChevronRight, Search } from "lucide-react"

const PAGE_SIZE = 10

type ListMember = Parameters<typeof memberName>[0] & Parameters<typeof formatSubGroups>[0] & {
  id: string
  company?: string | null
}

export function AdminMembersList({ members }: { members: ListMember[] }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...members].sort((a, b) => memberName(a).localeCompare(memberName(b)))
    if (!q) return sorted
    return sorted.filter((m) =>
      [memberName(m), m.company ?? "", formatSubGroups(m)].some((field) => field.toLowerCase().includes(q)),
    )
  }, [members, query])

  // A new search (or a sub-group filter change upstream) starts from page 1.
  useEffect(() => {
    setPage(1)
  }, [matches])

  const pageMembers = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function goTo(next: number) {
    setPage(next)
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  if (members.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No member activity yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={topRef} className="relative scroll-mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, business or sub-group"
          aria-label="Search members"
          className="h-11 pl-9"
        />
      </div>

      {matches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {"No members match \u201C"}
          {query.trim()}
          {"\u201D."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pageMembers.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/member/${m.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-accent/60"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold leading-tight">{memberName(m)}</span>
                  <span className="truncate text-sm leading-relaxed text-muted-foreground">
                    {m.company ? `${m.company} · ${formatSubGroups(m)}` : formatSubGroups(m)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PageNav page={page} pageSize={PAGE_SIZE} totalItems={matches.length} onPageChange={goTo} label="Member pages" />
    </div>
  )
}
