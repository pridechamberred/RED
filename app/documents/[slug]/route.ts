import { readFile } from "node:fs/promises"
import path from "node:path"
import { getCurrentMember } from "@/lib/data"
import { documentsForRole } from "@/lib/documents"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentMember()
  if (!me) return new Response("Unauthorized", { status: 401 })

  const { slug } = await params
  const doc = documentsForRole(me.role).find((d) => d.slug === slug)
  if (!doc) return new Response("Not found", { status: 404 })

  const file = await readFile(path.join(process.cwd(), "documents", doc.fileName))
  const download = new URL(request.url).searchParams.has("download")

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
