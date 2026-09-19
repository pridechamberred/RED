"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AUDIENCE_LABELS,
  EMAIL_TEMPLATES,
  type EmailAudience,
  type EmailTemplateMeta,
  defaultCopy,
  diffFromDefault,
  mergeCopy,
} from "@/lib/email-templates"
import {
  previewEmailTemplateAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
} from "@/app/admin/email-templates/actions"

type CopyMap = Record<string, string>
type OverridesByTemplate = Record<string, CopyMap>

const AUDIENCE_ORDER: EmailAudience[] = ["member", "guest", "internal"]

function fullCopyFor(overrides: OverridesByTemplate) {
  const out: OverridesByTemplate = {}
  for (const template of EMAIL_TEMPLATES) out[template.id] = mergeCopy(template.id, overrides[template.id])
  return out
}

export function EmailTemplateEditor({ overrides }: { overrides: OverridesByTemplate }) {
  // `saved` mirrors what's persisted; `draft` holds unsaved edits. Both always
  // carry a full set of fields (defaults merged in), so lookups never miss.
  const [saved, setSaved] = useState<OverridesByTemplate>(() => fullCopyFor(overrides))
  const [draft, setDraft] = useState<OverridesByTemplate>(() => fullCopyFor(overrides))
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => EMAIL_TEMPLATES.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  )

  if (!selected) {
    return (
      <TemplateList
        saved={saved}
        onSelect={(id) => setSelectedId(id)}
      />
    )
  }

  return (
    <TemplateEditorPanel
      key={selected.id}
      template={selected}
      draftCopy={draft[selected.id]}
      savedCopy={saved[selected.id]}
      onBack={() => setSelectedId(null)}
      onChange={(key, value) =>
        setDraft((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], [key]: value } }))
      }
      onResetField={(key) =>
        setDraft((prev) => ({
          ...prev,
          [selected.id]: { ...prev[selected.id], [key]: defaultCopy(selected.id)[key] },
        }))
      }
      onSaved={(copy) => setSaved((prev) => ({ ...prev, [selected.id]: copy }))}
      onResetAll={() => {
        const defaults = defaultCopy(selected.id)
        setDraft((prev) => ({ ...prev, [selected.id]: defaults }))
        setSaved((prev) => ({ ...prev, [selected.id]: defaults }))
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

function TemplateList({
  saved,
  onSelect,
}: {
  saved: OverridesByTemplate
  onSelect: (id: string) => void
}) {
  const grouped = AUDIENCE_ORDER.map((audience) => ({
    audience,
    templates: EMAIL_TEMPLATES.filter((t) => t.audience === audience),
  })).filter((group) => group.templates.length > 0)

  return (
    <div className="flex flex-col gap-7">
      {grouped.map(({ audience, templates }) => (
        <section key={audience} className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {AUDIENCE_LABELS[audience]}
          </h2>
          <ul className="flex flex-col gap-2">
            {templates.map((template) => {
              const customised = Object.keys(diffFromDefault(template.id, saved[template.id])).length > 0
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(template.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{template.name}</span>
                        {customised ? (
                          <Badge variant="secondary" className="shrink-0">
                            Customised
                          </Badge>
                        ) : null}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">{template.description}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor panel
// ---------------------------------------------------------------------------

function TemplateEditorPanel({
  template,
  draftCopy,
  savedCopy,
  onBack,
  onChange,
  onResetField,
  onSaved,
  onResetAll,
}: {
  template: EmailTemplateMeta
  draftCopy: CopyMap
  savedCopy: CopyMap
  onBack: () => void
  onChange: (key: string, value: string) => void
  onResetField: (key: string) => void
  onSaved: (copy: CopyMap) => void
  onResetAll: () => void
}) {
  const defaults = useMemo(() => defaultCopy(template.id), [template.id])
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})
  const lastFocusedField = useRef<string | null>(null)

  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  // Preview state, refreshed (debounced) whenever the draft changes.
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null)
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html")
  const [previewLoading, setPreviewLoading] = useState(true)
  const previewSeq = useRef(0)

  const dirty = useMemo(
    () => template.fields.some((f) => draftCopy[f.key] !== savedCopy[f.key]),
    [template.fields, draftCopy, savedCopy],
  )
  const customised = useMemo(
    () => Object.keys(diffFromDefault(template.id, savedCopy)).length > 0,
    [template.id, savedCopy],
  )

  // Debounced live preview. A sequence number guards against an earlier, slower
  // response landing after a later one and showing stale copy.
  useEffect(() => {
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      const result = await previewEmailTemplateAction(template.id, draftCopy)
      if (seq !== previewSeq.current) return
      if (result.ok) {
        setPreview(result.preview)
      }
      setPreviewLoading(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [template.id, draftCopy])

  const insertVariable = useCallback(
    (token: string) => {
      const key = lastFocusedField.current ?? template.fields[0]?.key
      if (!key) return
      const el = fieldRefs.current[key]
      const snippet = `{${token}}`
      const current = draftCopy[key] ?? ""
      if (el && typeof el.selectionStart === "number") {
        const start = el.selectionStart
        const end = el.selectionEnd ?? start
        const next = current.slice(0, start) + snippet + current.slice(end)
        onChange(key, next)
        // Restore the caret just after the inserted token.
        requestAnimationFrame(() => {
          el.focus()
          const caret = start + snippet.length
          el.setSelectionRange(caret, caret)
        })
      } else {
        onChange(key, current + snippet)
      }
    },
    [draftCopy, onChange, template.fields],
  )

  const handleSave = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await saveEmailTemplateAction(template.id, draftCopy)
      if (result.ok) {
        onSaved({ ...draftCopy })
        setMessage({ tone: "success", text: "Saved. This wording is now live." })
      } else {
        setMessage({ tone: "error", text: result.error })
      }
    })
  }

  const handleResetAll = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await resetEmailTemplateAction(template.id)
      if (result.ok) {
        onResetAll()
        setMessage({ tone: "success", text: "Restored the default wording." })
      } else {
        setMessage({ tone: "error", text: result.error })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All templates
        </button>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">{template.name}</h2>
            {customised ? <Badge variant="secondary">Customised</Badge> : <Badge variant="outline">Default</Badge>}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{template.description}</p>
          <p className="text-xs text-muted-foreground">
            Sent from <span className="font-medium text-foreground">{template.sender}</span>
          </p>
        </div>
      </div>

      {/* Variables */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3.5">
        <p className="text-xs font-semibold text-foreground">Insert a value</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Click to drop a value into the field you last edited. Each is filled in automatically when the email is sent.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {template.variables.map((variable) => (
            <button
              key={variable.token}
              type="button"
              onClick={() => insertVariable(variable.token)}
              title={variable.label}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <Plus className="size-3 text-muted-foreground" aria-hidden />
              {`{${variable.token}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-5">
        {template.fields.map((field) => {
          const value = draftCopy[field.key] ?? ""
          const changedFromDefault = value !== defaults[field.key]
          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                {changedFromDefault ? (
                  <button
                    type="button"
                    onClick={() => onResetField(field.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    Reset
                  </button>
                ) : null}
              </div>
              {field.multiline ? (
                <Textarea
                  id={`field-${field.key}`}
                  ref={(el) => {
                    fieldRefs.current[field.key] = el
                  }}
                  value={value}
                  rows={3}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  onFocus={() => {
                    lastFocusedField.current = field.key
                  }}
                />
              ) : (
                <Input
                  id={`field-${field.key}`}
                  ref={(el) => {
                    fieldRefs.current[field.key] = el
                  }}
                  value={value}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  onFocus={() => {
                    lastFocusedField.current = field.key
                  }}
                />
              )}
              {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
            </div>
          )
        })}
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Preview</h3>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setPreviewMode("html")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                previewMode === "html" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("text")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                previewMode === "text" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Plain text
            </button>
          </div>
        </div>

        <div className="flex items-baseline gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Subject</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {preview?.subject || "\u2014"}
          </span>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-white">
          {previewLoading ? (
            <div className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 shadow-sm">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : null}
          {previewMode === "html" ? (
            <iframe
              title={`Preview of the ${template.name} email`}
              srcDoc={preview?.html ?? ""}
              sandbox=""
              className="h-[540px] w-full bg-white"
            />
          ) : (
            <pre className="h-[540px] w-full overflow-auto whitespace-pre-wrap bg-white p-4 font-mono text-xs leading-relaxed text-neutral-800">
              {preview?.text ?? ""}
            </pre>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Preview uses sample details in place of real names and dates.</p>
      </div>

      {/* Actions */}
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          aria-live={message.tone === "error" ? "assertive" : "polite"}
          className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
            message.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/5 text-foreground"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={!dirty || pending} className="h-11 w-full">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : dirty ? "Save changes" : "Saved"}
        </Button>
        {customised || dirty ? (
          <Button
            onClick={handleResetAll}
            disabled={pending}
            variant="ghost"
            className="h-11 w-full text-muted-foreground"
          >
            Restore default wording
          </Button>
        ) : null}
      </div>
    </div>
  )
}
