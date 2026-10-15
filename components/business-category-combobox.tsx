"use client"

import { useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { BUSINESS_CATEGORY_GROUPS } from "@/lib/business-categories"
import { cn } from "@/lib/utils"

type Props = {
  id: string
  name: string
  defaultValue: string
  invalid?: boolean
  describedBy?: string
}

export function BusinessCategoryCombobox({ id, name, defaultValue, invalid, describedBy }: Props) {
  const listboxId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [query, setQuery] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const isTyping = query !== value
  const term = isTyping ? query.trim().toLowerCase() : ""

  const groups = useMemo(() => {
    if (!term) return BUSINESS_CATEGORY_GROUPS
    return BUSINESS_CATEGORY_GROUPS.map((g) =>
      g.group.toLowerCase().includes(term)
        ? g
        : { ...g, options: g.options.filter((o) => o.toLowerCase().includes(term)) },
    ).filter((g) => g.options.length > 0)
  }, [term])

  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups])

  function optionId(index: number) {
    return `${listboxId}-opt-${index}`
  }

  function scrollToIndex(index: number) {
    listRef.current?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView({ block: "nearest" })
  }

  function select(option: string) {
    setValue(option)
    setQuery(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  function clear() {
    setValue("")
    setQuery("")
    setActiveIndex(-1)
  }

  function revert() {
    setOpen(false)
    setActiveIndex(-1)
    if (query.trim() === "") setValue("")
    else setQuery(value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) setOpen(true)
      if (flat.length === 0) return
      const next =
        e.key === "ArrowDown"
          ? (activeIndex + 1) % flat.length
          : (activeIndex - 1 + flat.length) % flat.length
      setActiveIndex(next)
      scrollToIndex(next)
    } else if (e.key === "Enter") {
      if (!open) return
      e.preventDefault()
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      const pick = flat[activeIndex] ?? (flat.length === 1 ? flat[0] : undefined)
      if (pick) select(pick)
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        revert()
      }
    }
  }

  let runningIndex = -1

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder="Search categories, e.g. Plumbing"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={revert}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent pl-3 pr-16 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
            invalid && "border-destructive ring-3 ring-destructive/20",
          )}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear business category"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      {open ? (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Business categories"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {'No matches. Try "Other" or "Not Listed".'}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group} className="flex flex-col">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </p>
                {g.options.map((option) => {
                  runningIndex += 1
                  const index = runningIndex
                  const selected = option === value
                  return (
                    <div
                      key={option}
                      id={optionId(index)}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(option)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                        index === activeIndex && "bg-muted",
                        selected && "font-medium text-primary",
                      )}
                    >
                      {option}
                      {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
