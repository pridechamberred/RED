"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { MemberAvatar } from "@/components/member-avatar"
import { type MemberOption, memberName } from "@/lib/types"
import { Search, X } from "lucide-react"

/**
 * Forgiving search-as-you-type over the member list. Matches on first name,
 * last name, full name and company, token by token, so "sarah mark" finds
 * Sarah Smith of Smith Marketing.
 */
function score(member: MemberOption, tokens: string[]) {
  const first = member.first_name.toLowerCase()
  const last = member.last_name.toLowerCase()
  const full = `${first} ${last}`
  const company = (member.company ?? "").toLowerCase()

  let total = 0

  for (const token of tokens) {
    let best = 0
    if (first.startsWith(token) || last.startsWith(token)) best = 4
    else if (full.includes(token)) best = 3
    else if (company.split(/\s+/).some((w) => w.startsWith(token))) best = 2
    else if (company.includes(token)) best = 1

    if (best === 0) return 0 // every token must match something
    total += best
  }

  return total
}

export function MemberSearch({ members }: { members: MemberOption[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []

    return members
      .map((m) => ({ member: m, s: score(m, tokens) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || memberName(a.member).localeCompare(memberName(b.member)))
      .slice(0, 8)
      .map((r) => r.member)
  }, [members, query])

  const showEmpty = query.trim().length > 0 && results.length === 0

  return (
    <section aria-label="Find a member" className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name/business"
          aria-label="Search a member"
          aria-describedby="member-search-hint"
          autoComplete="off"
          className="h-14 rounded-full border-border bg-card pl-12 pr-11 text-base shadow-sm transition-shadow focus-visible:shadow-md [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Clear search</span>
          </button>
        ) : null}
      </div>

      <p
        id="member-search-hint"
        className={`px-1 text-sm leading-relaxed text-muted-foreground ${query.length > 0 ? "sr-only" : ""}`}
      >
        Start typing a name or business to record a vous or pass a referral.
      </p>

      {results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => router.push(`/member/${m.id}`)}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/60"
              >
                <MemberAvatar member={m} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold leading-tight">{memberName(m)}</span>
                  <span className="truncate text-sm leading-relaxed text-muted-foreground">
                    {m.company || m.sub_group}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No members match {`"${query.trim()}"`}.
        </p>
      ) : null}
    </section>
  )
}
