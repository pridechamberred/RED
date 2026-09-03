import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS and can use the Auth admin API,
 * so it is the only way the app can create a login for someone else.
 *
 * `server-only` is deliberate: if this module were ever pulled into a client
 * component the service-role key would ship in the browser bundle, handing any
 * visitor full read/write over every table. Callers MUST do their own
 * authorization check first — this client has no concept of "who is asking".
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin client is not configured (missing URL or service role key).")
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
