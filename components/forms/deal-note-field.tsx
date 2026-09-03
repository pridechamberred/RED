"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** Mirrors the length check on public.done_deal_notes.note. */
export const DEAL_NOTE_MAX = 500

/**
 * The private "Notes" box for a done deal, shared by the add form and the
 * Update panel so the warning about customer data reads identically in both.
 *
 * The note is stored in public.done_deal_notes, which is owner-only by RLS, so
 * the "only you can see this" promise is enforced by the database and not just
 * by this label. See supabase/migrations/006-done-deal-private-notes.sql.
 */
export function DealNoteField({
  id = "notes",
  defaultValue = "",
  className,
}: {
  id?: string
  defaultValue?: string
  className?: string
}) {
  const [length, setLength] = useState(defaultValue.length)
  const over = length > DEAL_NOTE_MAX
  const describedBy = `${id}-hint`

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>
        Notes <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>

      <p id={describedBy} className="text-sm leading-relaxed text-muted-foreground">
        Add a note to help you remember what this deal was for, such as an invoice number or other vague reference.
        Please do not add any identifying customer data, such as names, addresses etc.
      </p>

      <Textarea
        id={id}
        name="notes"
        rows={3}
        maxLength={DEAL_NOTE_MAX}
        defaultValue={defaultValue}
        aria-describedby={describedBy}
        onChange={(e) => setLength(e.currentTarget.value.length)}
        className="resize-none bg-card text-base"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="size-3.5 shrink-0" />
          Private to you — never shown to admins.
        </p>
        <p className={cn("text-xs tabular-nums text-muted-foreground", over && "font-semibold text-destructive")}>
          {length}/{DEAL_NOTE_MAX}
        </p>
      </div>
    </div>
  )
}
