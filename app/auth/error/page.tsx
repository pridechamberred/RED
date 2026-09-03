import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"
import { TriangleAlert } from "lucide-react"

const REASONS: Record<string, { title: string; body: string }> = {
  otp_expired: {
    title: "That link has already been used",
    body: "Confirmation links work only once. If you clicked it twice — or your email provider scanned it first — it stops working. Sign up again to get a fresh link, then click it once.",
  },
  missing_token: {
    title: "That link was incomplete",
    body: "It arrived without a confirmation token, which usually means the link was clipped by your email app. Try copying the whole link from the email, or sign up again for a new one.",
  },
  access_denied: {
    title: "That link didn't work",
    body: "It may have expired or already been used. Request a new one by signing up again.",
  },
}

const FALLBACK = {
  title: "That link didn't work",
  body: "It may have expired or already been used. Try signing in, or request a new link by signing up again.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const { title, body } = (reason && REASONS[reason]) || FALLBACK

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <BrandMark size="lg" />
        <span className="flex size-14 items-center justify-center rounded-full bg-accent">
          <TriangleAlert className="size-7 text-accent-foreground" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button render={<Link href="/auth/login" />} nativeButton={false} size="lg" className="h-12 w-full text-base">
            Back to sign in
          </Button>
        </div>
      </div>
    </main>
  )
}
