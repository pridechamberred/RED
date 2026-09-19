"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMember } from "@/lib/data"
import { isSuperAdmin } from "@/lib/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { diffFromDefault, getEmailTemplate } from "@/lib/email-templates"
import { renderEmailPreview, type EmailPreview } from "@/lib/email"

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Every action re-checks super-admin server-side. The page already gates the
 * UI, but hiding a page is not access control: these actions use the
 * service-role client, so a forged POST from a plain member must be rejected
 * here or it could rewrite what every member receives.
 */
async function requireSuperAdmin() {
  const me = await getCurrentMember()
  if (!me || !isSuperAdmin(me.role)) return null
  return me
}

/**
 * Saves a template's copy. Only the fields that differ from the code default
 * are stored, so future default rewordings still reach untouched fields. If
 * nothing differs, the override row is removed entirely (a clean reset).
 */
export async function saveEmailTemplateAction(
  templateId: string,
  copy: Record<string, string>,
): Promise<ActionResult> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: "You must be a super-admin to edit email templates." }

  const template = getEmailTemplate(templateId)
  if (!template) return { ok: false, error: "Unknown email template." }

  const diff = diffFromDefault(templateId, copy)
  const supabase = createAdminClient()

  try {
    if (Object.keys(diff).length === 0) {
      const { error } = await supabase.from("email_template_overrides").delete().eq("template_id", templateId)
      if (error) throw error
    } else {
      const { error } = await supabase.from("email_template_overrides").upsert(
        {
          template_id: templateId,
          copy: diff,
          updated_at: new Date().toISOString(),
          updated_by: me.id,
        },
        { onConflict: "template_id" },
      )
      if (error) throw error
    }
  } catch (err) {
    console.error(`[v0] email editor: save failed for ${templateId}:`, err instanceof Error ? err.message : err)
    return { ok: false, error: "Could not save. Please try again." }
  }

  revalidatePath("/admin/email-templates")
  return { ok: true }
}

/** Clears all overrides for a template, restoring the shipped defaults. */
export async function resetEmailTemplateAction(templateId: string): Promise<ActionResult> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: "You must be a super-admin to edit email templates." }

  const template = getEmailTemplate(templateId)
  if (!template) return { ok: false, error: "Unknown email template." }

  const supabase = createAdminClient()
  const { error } = await supabase.from("email_template_overrides").delete().eq("template_id", templateId)
  if (error) {
    console.error(`[v0] email editor: reset failed for ${templateId}:`, error.message)
    return { ok: false, error: "Could not reset. Please try again." }
  }

  revalidatePath("/admin/email-templates")
  return { ok: true }
}

/**
 * Renders a live preview from unsaved draft copy, using the real send-path
 * renderer with sample data. Kept server-side because the renderer lives beside
 * server-only modules; the editor calls it (debounced) as fields change.
 */
export async function previewEmailTemplateAction(
  templateId: string,
  copy: Record<string, string>,
): Promise<{ ok: true; preview: EmailPreview } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: "Not authorized." }

  try {
    return { ok: true, preview: renderEmailPreview(templateId, copy) }
  } catch (err) {
    console.error(`[v0] email editor: preview failed for ${templateId}:`, err instanceof Error ? err.message : err)
    return { ok: false, error: "Could not render preview." }
  }
}
