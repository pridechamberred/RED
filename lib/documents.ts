import { isAdmin, type Role } from "@/lib/types"

export type AppDocument = {
  slug: string
  title: string
  description: string
  fileName: string
  adminOnly: boolean
}

// PDFs live in /documents (not /public) so the admin guide can only be
// fetched through the role-checked route at /documents/[slug].
export const DOCUMENTS: AppDocument[] = [
  {
    slug: "quick-guide",
    title: "incREDible Quick Guide",
    description: "Getting started, your profile, and logging activity.",
    fileName: "incredible-quick-guide-nov-2026.pdf",
    adminOnly: false,
  },
  {
    slug: "admin-guide",
    title: "incREDible Admin Guide",
    description: "Adding members, attendance, guest requests, and reports.",
    fileName: "incredible-admin-guide-nov-2026.pdf",
    adminOnly: true,
  },
]

export function documentsForRole(role: Role): AppDocument[] {
  return DOCUMENTS.filter((doc) => !doc.adminOnly || isAdmin(role))
}
