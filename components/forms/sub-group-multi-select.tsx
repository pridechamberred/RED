"use client"

import { Check } from "lucide-react"
import { SUB_GROUPS, type SubGroup } from "@/lib/types"

/**
 * A group of toggle chips for picking one OR MORE sub-groups.
 *
 * Deliberately not a `<select multiple>` (miserable on touch) nor a checkbox
 * list — the chips read as "tap the groups this member is in". Each chip is a
 * real button with `aria-pressed`, wrapped in a labelled group, so it is
 * announced correctly. Selection order follows `SUB_GROUPS` so the primary
 * group (the first selected) is deterministic regardless of tap order.
 */
export function SubGroupMultiSelect({
  value,
  onChange,
  ariaLabel = "Sub-groups",
  idPrefix = "sub-group",
}: {
  value: SubGroup[]
  onChange: (next: SubGroup[]) => void
  ariaLabel?: string
  idPrefix?: string
}) {
  function toggle(group: SubGroup) {
    const has = value.includes(group)
    const next = has ? value.filter((g) => g !== group) : [...value, group]
    // Keep the stored order canonical so the first element is a stable primary.
    onChange(SUB_GROUPS.filter((g) => next.includes(g)))
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {SUB_GROUPS.map((group) => {
        const selected = value.includes(group)
        return (
          <button
            key={group}
            id={`${idPrefix}-${group}`}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(group)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/60"
            }`}
          >
            <Check
              className={`size-4 shrink-0 transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
              aria-hidden
            />
            {group}
          </button>
        )
      })}
    </div>
  )
}
