export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-accent px-3 py-2.5 text-sm leading-relaxed text-accent-foreground">
      {message}
    </p>
  )
}
