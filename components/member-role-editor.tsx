"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/form-error"
import { updateMemberRole, type EditableRole } from "@/app/admin/member/[id]/actions"
import { cn } from "@/lib/utils"

const OPTIONS: { value: EditableRole; label: string; hint: string }[] = [
  { value: "user", label: "User", hint: "Can log their own activity." },
  { value: "admin", label: "Admin", hint: "Can view and manage their sub-groups." },
]

/** Super-admin control for switching a member between User and Admin. */
export function MemberRoleEditor({
  memberId,
  memberName,
  role,
}: {
  memberId: string
  memberName: string
  role: EditableRole
}) {
  const [selected, setSelected] = useState<EditableRole>(role)
  const [saved, setSaved] = useState<EditableRole>(role)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSave() {
    setError(null)
    setDone(false)
    setPending(true)
    const result = await updateMemberRole(memberId, selected)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSaved(result.role)
    setSelected(result.role)
    setDone(true)
  }

  return (
    <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold">Role</h2>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {`Choose what ${memberName} can do in the app.`}
        </p>
      </div>

      <div role="radiogroup" aria-label={`Role for ${memberName}`} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelected(option.value)
                setDone(false)
              }}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted",
              )}
            >
              <span className={cn("text-sm font-semibold", active && "text-primary")}>{option.label}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{option.hint}</span>
            </button>
          )
        })}
      </div>

      <FormError message={error} />

      {done ? (
        <p role="status" className="text-sm font-medium text-primary">
          Role updated.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={onSave}
        disabled={pending || selected === saved}
        className="h-11 w-full sm:w-auto sm:self-start"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Saving..." : "Save role"}
      </Button>
    </section>
  )
}
