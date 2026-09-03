/**
 * Marks a session that arrived through a password reset link.
 *
 * Set by /auth/callback once a recovery token verifies, read by the proxy to
 * make /auth/set-password reachable, and cleared once the new password is
 * saved. A cookie is used rather than the must_change_password metadata flag
 * because admin-side metadata writes do not refresh the session JWT the proxy
 * reads, so that flag would still appear false for the rest of the session.
 */
export const RECOVERY_COOKIE = "red_password_recovery"
