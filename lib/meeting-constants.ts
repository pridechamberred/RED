/**
 * Sentinel for "Not sure yet" in the guest-invite meeting dropdown.
 *
 * Lives in its own module because both the client form and the server action
 * need it, and `lib/meeting-options.ts` is `server-only` — importing that from a
 * client component would break the build.
 */
export const NO_MEETING = "none"
