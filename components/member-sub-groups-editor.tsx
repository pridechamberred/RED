"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/form-error"
import { SubGroupMultiSelect } from "@/components/forms/sub-group-multi-select"
import { updateMemberSubGroups } from "@/app/admin/member/[id]/actions"
import { SUB_GROUPS, type SubGroup } from "@/lib/types"

/** Admin control for putting a member in one or more sub-groups. */
export function MemberSubGroupsEditor({
  memberId,
  memberName,
  subGroups,
}: {
  memberId: string
  memberName: string
  subGroups: SubGroup[]
}) {
  const [selected, setSelected] = useState<SubGroup[]>(subGroups)
  const [saved, setSaved] = useState<SubGroup[]>(subGroups)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Compare against the last saved set, order-independent, so the Save button is
  // only enabled when there is a real change to persist.
  const dirty =
    selected.length !== saved.length || SUB_GROUPS.some((g) => selected.includes(g) !== saved.includes(g))

  async function onSave() {
    setError(null)
    setDone(false)
    if (selected.length === 0) {
      setError("Choose at least one sub-group.")
      return
    }
    setPending(true)
    const result = await updateMemberSubGroups(memberId, selected)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSaved(result.subGroups)
    setSelected(result.subGroups)
    setDone(true)
  }

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold">Sub-groups</h2>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          {`Groups ${memberName} belongs to. Members can be in more than one — they appear on every one of their groups' registers, reports and admin views. The first selected is their primary group.`}
        </p>
      </div>

      <SubGroupMultiSelect
        value={selected}
        onChange={(next) => {
          setSelected(next)
          setDone(false)
        }}
        ariaLabel={`Sub-groups for ${memberName}`}
      />

      <FormError message={error} />

      {done ? (
        <p role="status" className="text-sm font-medium text-primary">
          Sub-groups updated.
        </p>
      ) : null}

      <Button type="button" onClick={onSave} disabled={pending || !dirty} className="h-11 w-full sm:w-auto sm:self-start">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Saving..." : "Save sub-groups"}
      </Button>
    </section>
  )
}
