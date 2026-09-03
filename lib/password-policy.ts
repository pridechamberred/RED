/**
 * Shared password rules for incREDible.
 *
 * Kept in one place so the first-time password screen, any future admin reset,
 * and the sign-up form can never drift apart on what counts as acceptable.
 */

export const PASSWORD_MIN_LENGTH = 10

export type PasswordRule = {
  id: string
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "number", label: "One number", test: (v) => /[0-9]/.test(v) },
  {
    id: "special",
    label: "One special character",
    // Anything that is not a letter or a number counts, so members are not
    // forced to hunt for a character from an arbitrary approved list.
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
]

/** True only when every rule passes. */
export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
