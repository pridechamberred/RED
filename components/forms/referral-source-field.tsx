"use client"

import { useMemo } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronDown } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  REFERRAL_SOURCE_LABELS,
  type MemberOption,
  type ReferralSource,
  memberName,
} from "@/lib/types"

/**
 * One entry in the dropdown. `source` is what gets stored; `memberId` is set
 * only for real members, which is what lets the caller send both halves of the
 * answer without the option list leaking member ids into the other three.
 */
export type ReferralSourceOption = {
  /** The value submitted for `referralSource`. */
  source: ReferralSource
  /** Set only when source is "member". */
  memberId: string | null
  /** What the member reads and types against. */
  label: string
  /** Company, sub-group etc. Shown under the label to tell alike names apart. */
  hint: string | null
}

/**
 * Builds the option list: the three fixed categories first, then every member
 * in the database A–Z by first name.
 *
 * The fixed three lead deliberately. They are the answers that need no
 * searching, and putting them above a long member list means the common cases
 * are one tap away on a phone.
 */
export function buildReferralSourceOptions(members: MemberOption[]): ReferralSourceOption[] {
  const fixed: ReferralSourceOption[] = [
    { source: "confidential", memberId: null, label: REFERRAL_SOURCE_LABELS.confidential, hint: null },
    { source: "pride-chamber", memberId: null, label: REFERRAL_SOURCE_LABELS["pride-chamber"], hint: null },
    {
      source: "former-red-member",
      memberId: null,
      label: REFERRAL_SOURCE_LABELS["former-red-member"],
      hint: null,
    },
  ]

  // Sorted by first name, then last, using localeCompare so accented names land
  // where a reader expects rather than after Z. The server also orders by
  // first_name; this re-sort makes the tiebreak explicit and keeps the order
  // stable no matter how the rows arrive.
  const memberOptions = members
    .map<ReferralSourceOption>((m) => ({
      source: "member",
      memberId: m.id,
      label: memberName(m),
      hint: m.company ? `${m.company} · ${m.sub_group}` : m.sub_group,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return [...fixed, ...memberOptions]
}

/**
 * "This deal followed a referral from:" — a required typeahead dropdown.
 *
 * Uses Base UI's Combobox rather than the Select used elsewhere on this form
 * because the list runs to every member in the database, which is too long to
 * scroll comfortably; typing to filter is the point.
 *
 * Submits through two hidden inputs (`referralSource` and
 * `referralFromMemberId`) rather than the combobox's own name, because the
 * answer is two fields in the database and the server validates them as a
 * pair. The combobox itself is therefore unnamed.
 */
export function ReferralSourceField({
  options,
  value,
  onChange,
  id = "referralSource",
}: {
  options: ReferralSourceOption[]
  value: ReferralSourceOption | null
  onChange: (option: ReferralSourceOption | null) => void
  /**
   * Prefixed by the caller when this renders more than once on a page (the
   * record has a mobile and a desktop copy of the update panel in the DOM at
   * once), so the label and its hint resolve to the right instance.
   */
  id?: string
}) {
  const hintId = `${id}-hint`

  // Matching on the label alone would make "Kowalski Bakery" unfindable, so the
  // company and sub-group in `hint` are searchable too — the same forgiving
  // behaviour as the member search box on the home page.
  const itemToStringLabel = (option: ReferralSourceOption) => option.label
  const filter = useMemo(
    () => (option: ReferralSourceOption, query: string) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase()
      // Every whitespace-separated token must appear, so "ben harper" and
      // "harper ben" both find the same person.
      return q.split(/\s+/).every((token) => haystack.includes(token))
    },
    [],
  )

  return (
    <Combobox.Root
      items={options}
      value={value}
      onValueChange={(next) => onChange(next)}
      itemToStringLabel={itemToStringLabel}
      isItemEqualToValue={(a, b) => a.source === b.source && a.memberId === b.memberId}
      filter={filter}
      autoHighlight
    >
      <div className="flex flex-col gap-2">
        {/*
          A native <Label>, not <Combobox.Label>: that part labels the Trigger,
          whereas the Input is the actual form control here, so using it would
          point the label at the wrong element. Base UI warns about exactly
          this. Verified in the browser — the console warning is what caught it.
        */}
        <Label htmlFor={id}>This deal followed a referral from:</Label>

        <div className="relative">
          <Combobox.Input
            id={id}
            required
            placeholder="Choose or type a name"
            aria-describedby={hintId}
            autoComplete="off"
            className="h-12 w-full rounded-lg border border-input bg-transparent pl-4 pr-11 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
          />
          <Combobox.Trigger
            aria-label="Show referral sources"
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <Combobox.Icon render={<ChevronDown className="size-4" aria-hidden />} />
          </Combobox.Trigger>
        </div>

        <p id={hintId} className="text-sm leading-relaxed text-muted-foreground">
          Start typing to find any RED member, or pick one of the first three options.
        </p>
      </div>

      <Combobox.Portal>
        {/*
          `side="bottom"` so the list drops below the input rather than flipping
          up over the fields above it, which is what it did by default on the
          record page. It still flips when there genuinely is no room below.
        */}
        <Combobox.Positioner side="bottom" align="start" sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {/*
              The padding sits on the inner <p>, not on Empty itself: Base UI
              requires this element to stay mounted so screen readers announce
              "no match" reliably, so styling it directly left an empty band of
              whitespace above the results. Caught in the browser.
            */}
            <Combobox.Empty>
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No match. Try part of a name or business.
              </p>
            </Combobox.Empty>
            <Combobox.List>
              {(option: ReferralSourceOption) => (
                <Combobox.Item
                  key={option.memberId ?? option.source}
                  value={option}
                  className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-2 pl-3 pr-9 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.label}</span>
                    {option.hint ? (
                      <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </span>
                  <Combobox.ItemIndicator className="absolute right-3 flex size-4 items-center justify-center">
                    <Check className="size-4" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>

      {/* The database stores this as two columns, so submit it as two fields. */}
      <input type="hidden" name="referralSource" value={value?.source ?? ""} />
      <input type="hidden" name="referralFromMemberId" value={value?.memberId ?? ""} />
    </Combobox.Root>
  )
}
