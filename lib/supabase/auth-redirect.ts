/**
 * Resolves where Supabase should send a member after they click an email link.
 *
 * v0 injects NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL (a hop through v0.app) so
 * auth callbacks can reach the sandboxed preview. That proxy is DEVELOPMENT
 * ONLY: it forwards to the preview host, so if it leaks into the real
 * deployment a live member clicking "confirm" is bounced to v0.app and then to
 * localhost, which is nothing on their machine. Because the variable is set at
 * the project level it IS present in production builds, so we must not trust
 * its mere presence — we gate on the host actually being a preview host.
 */
const PREVIEW_HOSTS = [/^localhost$/, /^127\.0\.0\.1$/, /\.vusercontent\.net$/, /\.v0\.dev$/, /\.v0\.app$/]

export function getAuthCallbackUrl(): string {
  const ownCallback = `${window.location.origin}/auth/callback`
  const proxy = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL

  if (!proxy) return ownCallback

  const isPreview = PREVIEW_HOSTS.some((pattern) => pattern.test(window.location.hostname))
  return isPreview ? proxy : ownCallback
}
