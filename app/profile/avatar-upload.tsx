"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MemberAvatar } from "@/components/member-avatar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { removeAvatar, saveAvatar } from "@/app/profile/avatar-actions"
import { Camera, Loader2, Trash2 } from "lucide-react"

const BUCKET = "avatars"

/** Matches the bucket's own allowed_mime_types, so we reject before uploading. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

/** Stored square, because every place it renders is a circle. */
const OUTPUT_SIZE = 512

/**
 * Centre-crops to a square and re-encodes at 512px JPEG.
 *
 * Phone cameras produce 3-6MB files, which are slow to upload on mobile data
 * and pointless for something displayed at 44px. This lands around 40-60KB.
 *
 * `imageOrientation: "from-image"` applies the EXIF rotation tag: without it,
 * portrait photos from most phones arrive sideways.
 */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement("canvas")
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas unavailable")
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not encode image"))),
      "image/jpeg",
      0.85,
    )
  })
}

export function AvatarUpload({
  member,
}: {
  member: { first_name: string; last_name: string; avatar_url: string | null }
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Shown immediately from the local file so the new picture appears the moment
   * it is chosen, rather than after the upload and revalidation round trip.
   */
  const [preview, setPreview] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError("Please choose a JPEG, PNG or WebP image.")
      return
    }

    setBusy("upload")
    let previewUrl: string | null = null
    // A plain local, not the `error` state: state updates are not visible to
    // the `finally` below in this same tick, so reading `error` there would
    // always see its previous value and keep a failed preview on screen.
    let saved = false

    try {
      const blob = await toSquareJpeg(file)

      previewUrl = URL.createObjectURL(blob)
      setPreview(previewUrl)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError("Please sign in again.")
        return
      }

      // Folder must be the auth uid — that is the rule Storage's own policies
      // enforce. Random file name so replacing a picture never has to fight a
      // stale CDN cache for the same URL.
      const path = `${user.id}/${crypto.randomUUID()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" })

      if (uploadError) {
        console.log("[v0] avatar upload error:", uploadError.message)
        setError("We couldn't upload that picture. Please try again.")
        return
      }

      const result = await saveAvatar(path)
      if (!result.ok) {
        setError(result.error)
        return
      }

      saved = true
      router.refresh()
    } catch (err) {
      console.log("[v0] avatar processing error:", err instanceof Error ? err.message : err)
      setError("We couldn't read that image. Please try a different one.")
    } finally {
      // Keep the preview on success (it matches what was just saved) but drop
      // it on failure so the avatar reverts to what is actually stored.
      setBusy(null)
      if (previewUrl && !saved) {
        URL.revokeObjectURL(previewUrl)
        setPreview(null)
      }
      // Cleared so choosing the same file again still fires a change event.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setError(null)
    setBusy("remove")
    const result = await removeAvatar()
    setBusy(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setPreview(null)
    router.refresh()
  }

  const shown = { ...member, avatar_url: preview ?? member.avatar_url }
  const hasPicture = Boolean(shown.avatar_url)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <MemberAvatar member={shown} size="lg" />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden />
          {hasPicture ? "Change photo" : "Add photo"}
        </Button>

        {hasPicture ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={handleRemove}>
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {busy === "upload" ? "Uploading your picture" : busy === "remove" ? "Removing your picture" : ""}
      </p>
    </div>
  )
}
