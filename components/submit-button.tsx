"use client"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function SubmitButton({ children, pending }: { children: React.ReactNode; pending: boolean }) {
  return (
    <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="sr-only">Saving</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
