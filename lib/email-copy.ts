import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { defaultCopy, mergeCopy } from "@/lib/email-templates"

/**
 * Resolves the copy a template should send with: stored overrides layered over
 * the code defaults, always returning a full set of fields.
 *
 * Read through the service-role client on purpose. Emails send from server
 * actions AND from the calendar-sync cron, which has no user session — so an
 * RLS-scoped client would fail for the cron. The table only ever holds
 * super-admin-authored copy, never user data, so bypassing RLS to read it is
 * safe.
 *
 * Never throws: a database hiccup must never stop an email going out, so any
 * failure falls back to the shipped defaults and logs loudly.
 */
export async function resolveEmailCopy(templateId: string): Promise<Record<string, string>> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("email_template_overrides")
      .select("copy")
      .eq("template_id", templateId)
      .maybeSingle()

    if (error) {
      console.error(`[v0] email copy: could not load overrides for ${templateId}, using defaults: ${error.message}`)
      return defaultCopy(templateId)
    }

    return mergeCopy(templateId, (data?.copy as Record<string, string> | null) ?? null)
  } catch (err) {
    console.error(
      `[v0] email copy: threw loading overrides for ${templateId}, using defaults:`,
      err instanceof Error ? err.message : String(err),
    )
    return defaultCopy(templateId)
  }
}

/**
 * Every stored override, keyed by template id, for the editor to seed its
 * fields. Tolerant by design: if the table does not exist yet (migration 016
 * not applied) or the read fails, it returns an empty map so the editor still
 * loads showing the shipped defaults. Saving will surface a clear error until
 * the migration is run.
 */
export async function getAllEmailOverrides(): Promise<Record<string, Record<string, string>>> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("email_template_overrides").select("template_id, copy")
    if (error) {
      console.error(`[v0] email copy: could not load overrides, showing defaults: ${error.message}`)
      return {}
    }

    const out: Record<string, Record<string, string>> = {}
    for (const row of data ?? []) {
      out[row.template_id as string] = (row.copy as Record<string, string> | null) ?? {}
    }
    return out
  } catch (err) {
    console.error(
      `[v0] email copy: threw loading overrides, showing defaults:`,
      err instanceof Error ? err.message : String(err),
    )
    return {}
  }
}
