import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
      },
      auth: {
        // Passkeys are behind an experimental flag in auth-js 2.112; without
        // this, auth.registerPasskey()/signInWithPasskey()/passkey.* throw at
        // call time. @supabase/ssr spreads `options.auth` first, so this
        // survives its own flowType/storage overrides.
        experimental: { passkey: true },
      },
    },
  )
}
