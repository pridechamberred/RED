/**
 * The attendance status vocabulary, shared by server and client.
 *
 * Deliberately its own module with NO `server-only` import and no Supabase
 * dependency: `components/attendance-toggle.tsx` is a client component and needs
 * these as runtime *values*. Putting them in `lib/attendance.ts` pulls
 * `lib/supabase/server.ts` (and therefore `next/headers`) into the client bundle,
 * which fails the build. Types alone were fine there — they erase at compile
 * time — which is why this only became a problem once real constants were added.
 */

/**
 * What an admin recorded for one person at one meeting.
 *
 * `substitute` means the member did not attend personally but sent someone in
 * their place. It is its own reporting category by product decision, never
 * folded into attended or absent, so either rule can be derived later.
 */
export type AttendanceStatus = "attended" | "absent" | "substitute"

/**
 * A recorded status, or `null` for "not recorded yet".
 *
 * `null` is modelled as the absence of a row rather than a status value —
 * reports must not confuse "no admin has ruled on this person" with a confirmed
 * absence.
 */
export type AttendanceMark = AttendanceStatus | null

/**
 * Statuses offered per subject. Substitute is members-only: a one-off visitor
 * either turned up or didn't, so "sent a substitute" has no meaning for a guest.
 * `setAttendance()` enforces the same rule server-side.
 */
export const MEMBER_STATUSES: AttendanceStatus[] = ["attended", "absent", "substitute"]
export const GUEST_STATUSES: AttendanceStatus[] = ["attended", "absent"]

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attended: "Attended",
  absent: "Absent",
  substitute: "Substitute",
}
