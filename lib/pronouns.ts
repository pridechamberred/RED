export const PRONOUN_PRESETS = ["She/Her", "He/Him", "They/Them"] as const

/** Stored in `members.pronouns` when the member chose "Do not show my pronouns". */
export const PRONOUNS_HIDDEN = "hidden"

export const PRONOUN_OTHER_MAX = 40

export type PronounChoice = (typeof PRONOUN_PRESETS)[number] | "other" | "hidden" | ""

export const PRONOUN_CHOICE_LABELS: Record<Exclude<PronounChoice, "">, string> = {
  "She/Her": "She/Her",
  "He/Him": "He/Him",
  "They/Them": "They/Them",
  other: "Other",
  hidden: "Do not show my pronouns",
}

function isPreset(value: string): value is (typeof PRONOUN_PRESETS)[number] {
  return (PRONOUN_PRESETS as readonly string[]).includes(value)
}

/** Splits the stored column back into the dropdown choice + the free-text box. */
export function parseStoredPronouns(value: string | null | undefined): { choice: PronounChoice; other: string } {
  const v = (value ?? "").trim()
  if (!v) return { choice: "", other: "" }
  if (v === PRONOUNS_HIDDEN) return { choice: "hidden", other: "" }
  if (isPreset(v)) return { choice: v, other: "" }
  return { choice: "other", other: v }
}

export function isPronounChoice(value: string): value is PronounChoice {
  return value === "" || value === "other" || value === "hidden" || isPreset(value)
}

/** What to show publicly, or null when unset / hidden. */
export function displayPronouns(value: string | null | undefined): string | null {
  const v = (value ?? "").trim()
  if (!v || v === PRONOUNS_HIDDEN) return null
  return v
}
