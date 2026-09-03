import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <BrandMark size="lg" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">We couldn&apos;t find that</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            The page or member you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <Button render={<Link href="/" />} nativeButton={false} size="lg" className="h-12 w-full text-base">
          Back to Home
        </Button>
      </div>
    </main>
  )
}
