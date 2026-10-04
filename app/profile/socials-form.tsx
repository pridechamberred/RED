"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SOCIAL_ICONS } from "@/components/social-icons"
import { SOCIAL_PLATFORMS, type SocialKey } from "@/lib/socials"
import { saveSocials, type SocialsState } from "@/app/profile/socials-actions"
import { cn } from "@/lib/utils"

export function SocialsForm({ initial }: { initial: Partial<Record<SocialKey, string>> }) {
  const [state, action, pending] = useActionState<SocialsState, FormData>(saveSocials, {
    status: "idle",
    values: initial,
  })
  const values = state.values ?? initial

  return (
    <section aria-labelledby="socials-heading" className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="socials-heading" className="text-lg font-semibold tracking-tight">
          Your socials
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Paste a profile link or type your username. Other members will see these on your page.
        </p>
      </div>

      <form
        action={action}
        // Re-mount the inputs after each save so they show the normalised links.
        key={state.status === "saved" ? JSON.stringify(state.values) : "editing"}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
      >
        {SOCIAL_PLATFORMS.map((platform) => {
          const Icon = SOCIAL_ICONS[platform.key]
          const error = state.fieldErrors?.[platform.key]
          const id = `social-${platform.key}`
          return (
            <div key={platform.key} className="flex flex-col gap-1.5">
              <Label htmlFor={id} className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {platform.label}
              </Label>
              <Input
                id={id}
                name={platform.key}
                defaultValue={values[platform.key] ?? ""}
                placeholder={platform.placeholder}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="url"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="h-11"
              />
              {error ? (
                <p id={`${id}-error`} className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}

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
          {pending ? "Saving…" : "Save socials"}
        </Button>
      </form>
    </section>
  )
}
