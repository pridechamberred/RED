import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"
import { MailCheck } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <BrandMark size="lg" />
        <span className="flex size-14 items-center justify-center rounded-full bg-accent">
          <MailCheck className="size-7 text-accent-foreground" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Check your email</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            We&apos;ve sent you a confirmation link. Click it to activate your account, then sign in.
          </p>
        </div>
        <Button render={<Link href="/auth/login" />} nativeButton={false} size="lg" className="h-12 w-full text-base">
          Back to sign in
        </Button>
      </div>
    </main>
  )
}
