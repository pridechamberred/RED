"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PRONOUN_CHOICE_LABELS, PRONOUN_OTHER_MAX, type PronounChoice } from "@/lib/pronouns"

const CHOICES = Object.keys(PRONOUN_CHOICE_LABELS) as Exclude<PronounChoice, "">[]

export function PronounsField({
  id,
  defaultChoice,
  defaultOther,
  error,
}: {
  id: string
  defaultChoice: PronounChoice
  defaultOther: string
  error?: string
}) {
  const [choice, setChoice] = useState<PronounChoice>(defaultChoice)
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="pronouns_choice" value={choice} />
      <Select value={choice || null} onValueChange={(v) => setChoice((v as PronounChoice | null) ?? "")}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue>
            {(v: string | null) =>
              v ? PRONOUN_CHOICE_LABELS[v as Exclude<PronounChoice, "">] : (
                <span className="text-muted-foreground">How do you identify?</span>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CHOICES.map((c) => (
            <SelectItem key={c} value={c}>
              {PRONOUN_CHOICE_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {choice === "other" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-other`} className="sr-only">
            Your pronouns
          </Label>
          <Input
            id={`${id}-other`}
            name="pronouns_other"
            defaultValue={defaultOther}
            maxLength={PRONOUN_OTHER_MAX}
            placeholder="e.g. Xe/Xem"
            required
            autoFocus={defaultChoice !== "other"}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className="h-11"
          />
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
