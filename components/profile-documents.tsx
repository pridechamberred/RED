import { Download, Eye, FileText } from "lucide-react"
import type { AppDocument } from "@/lib/documents"

export function ProfileDocuments({ documents }: { documents: AppDocument[] }) {
  if (documents.length === 0) return null

  return (
    <section aria-labelledby="documents-heading" className="mt-8 flex flex-col gap-3">
      <h2
        id="documents-heading"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Documents
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {documents.map((doc) => (
          <li key={doc.slug} className="flex items-center gap-3 px-4 py-3.5">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{doc.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground text-pretty">
                {doc.description}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/documents/${doc.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Eye className="size-5" aria-hidden />
                <span className="sr-only">View {doc.title}</span>
              </a>
              <a
                href={`/documents/${doc.slug}?download`}
                className="inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Download className="size-5" aria-hidden />
                <span className="sr-only">Download {doc.title}</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
