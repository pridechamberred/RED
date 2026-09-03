import "server-only"

/**
 * The shared password every member account is provisioned with.
 *
 * Deliberately server-only: this module is imported by the provisioning script
 * and by the set-password server action, never by a client component. If it were
 * in the client bundle anyone could read it out of the JavaScript and pair it
 * with a member's email address, since all 40 accounts start on this value.
 */
export const TEMPORARY_PASSWORD = "R3dR0ck5!"
