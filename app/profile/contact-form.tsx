"use client"

import { useActionState, useState } from "react"
import { Loader2, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveContact, type ContactState } from "@/app/profile/contact-actions"
import { cn } from "@/lib/utils"

export function ContactForm({ initialPhone, initialShare }: { initialPhone: string; initialShare: boolean }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(saveContact, {
    status: "idle",
    phone: initialPhone,
    share: initialShare,
  })
  const [share, setShare] = useState(initialShare)

  return (
    <section aria-labelledby="contact-heading" className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="contact-heading" className="text-lg font-semibold tracking-tight">
          Contact details
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add your phone number and choose whether other members can see how to reach you.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-phone" className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" aria-hidden />
            Phone number
          </Label>
          <Input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={state.phone}
            key={state.status === "saved" ? state.phone : "editing"}
            placeholder="(555) 123-4567"
            aria-invalid={state.phoneError ? true : undefined}
            aria-describedby={state.phoneError ? "contact-phone-error" : undefined}
            className="h-11"
          />
          {state.phoneError ? (
            <p id="contact-phone-error" className="text-sm text-destructive">
              {state.phoneError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span id="share-contact-label" className="text-sm font-medium leading-relaxed">
            Allow other RED members to see my phone number and email address
          </span>
          <input type="hidden" name="share_contact" value={share ? "yes" : "no"} />
          <YesNoSwitch checked={share} onChange={setShare} labelledBy="share-contact-label" />
        </div>

        {state.message ? (
          <p
            role="status"
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              state.status === "saved"
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : "Save contact details"}
        </Button>
      </form>
    </section>
  )
}

function YesNoSwitch({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-9 w-20 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "border-primary bg-primary" : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute text-xs font-bold tracking-wide transition-opacity",
          checked ? "left-3 text-primary-foreground opacity-100" : "right-3 text-muted-foreground opacity-100",
        )}
      >
        {checked ? "YES" : "NO"}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute top-1 size-7 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-11" : "translate-x-1",
        )}
      />
    </button>
  )
}
