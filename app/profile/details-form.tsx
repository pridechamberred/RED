"use client"

import { useActionState } from "react"
import { Briefcase, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveDetails, type DetailsState } from "@/app/profile/details-actions"
import { cn } from "@/lib/utils"

export function DetailsForm({ initialCompany, initialEmail }: { initialCompany: string; initialEmail: string }) {
  const [state, action, pending] = useActionState<DetailsState, FormData>(saveDetails, {
    status: "idle",
    company: initialCompany,
    email: initialEmail,
  })
  const formKey = state.status === "saved" ? `${state.company}|${state.email}` : "editing"

  return (
    <section aria-labelledby="details-heading" className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="details-heading" className="text-lg font-semibold tracking-tight">
          Business and email
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your email address is also what you use to sign in.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="details-company" className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" aria-hidden />
            Business name
          </Label>
          <Input
            id="details-company"
            name="company"
            autoComplete="organization"
            maxLength={120}
            defaultValue={state.company}
            key={`company-${formKey}`}
            placeholder="Your business"
            aria-invalid={state.companyError ? true : undefined}
            aria-describedby={state.companyError ? "details-company-error" : undefined}
            className="h-11"
          />
          {state.companyError ? (
            <p id="details-company-error" className="text-sm text-destructive">
              {state.companyError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="details-email" className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" aria-hidden />
            Email address
          </Label>
          <Input
            id="details-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            key={`email-${formKey}`}
            aria-invalid={state.emailError ? true : undefined}
            aria-describedby={state.emailError ? "details-email-error" : undefined}
            className="h-11"
          />
          {state.emailError ? (
            <p id="details-email-error" className="text-sm text-destructive">
              {state.emailError}
            </p>
          ) : null}
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
          {pending ? "Saving…" : "Save business and email"}
        </Button>
      </form>
    </section>
  )
}
