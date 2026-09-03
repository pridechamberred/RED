"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

const BUCKET = "avatars"

/** Marks the public-URL boundary, so a stored URL can be turned back into a storage path. */
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`

/**
 * The storage path inside the bucket for a previously saved public URL, or null
 * if this URL isn't one of ours.
 *
 * Needed because the column holds the full public URL (that is what <img> wants)
 * while the Storage API deletes by path. Returning null rather than guessing
 * means an unexpected value is skipped instead of turning into a wild delete.
 */
function pathFromPublicUrl(url: string | null) {
  if (!url) return null
  const at = url.indexOf(PUBLIC_PREFIX)
  if (at === -1) return null
  const path = url.slice(at + PUBLIC_PREFIX.length)
  return path.length > 0 ? path : null
}

/** Both pages that render an avatar, plus the member pages others see it on. */
function revalidateAvatar() {
  revalidatePath("/")
  revalidatePath("/profile")
  revalidatePath("/member", "layout")
}

type Result = { ok: true } | { ok: false; error: string }

/**
 * Records an already-uploaded avatar against the signed-in member.
 *
 * The file itself is uploaded straight from the browser — a phone photo would
 * otherwise have to travel through a server action's request body, which is
 * both slower and capped. Storage RLS is what enforces *where* it may land;
 * this action re-checks the same rule before trusting the path, so a crafted
 * call cannot point someone's profile at another member's folder.
 */
export async function saveAvatar(storagePath: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Please sign in again." }

  if (!storagePath.startsWith(`${user.id}/`)) {
    console.log("[v0] saveAvatar rejected path outside caller's folder:", storagePath)
    return { ok: false, error: "That upload didn't look right. Please try again." }
  }

  const { data: me } = await supabase
    .from("members")
    .select("id, avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!me) return { ok: false, error: "We couldn't find your member record." }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { error } = await supabase.from("members").update({ avatar_url: publicUrl }).eq("id", me.id)
  if (error) {
    console.log("[v0] saveAvatar update error:", error.message)
    return { ok: false, error: "We couldn't save your picture. Please try again." }
  }

  // Clear the previous file only after the new URL is safely stored. Doing it
  // the other way round risks deleting the picture the profile still points at.
  // A leftover file is untidy; a broken image is worse.
  const previous = pathFromPublicUrl(me.avatar_url)
  if (previous && previous !== storagePath) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove([previous])
    if (rmError) console.log("[v0] saveAvatar could not remove old file:", rmError.message)
  }

  revalidateAvatar()
  return { ok: true }
}

/** Drops the picture and goes back to initials. */
export async function removeAvatar(): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Please sign in again." }

  const { data: me } = await supabase
    .from("members")
    .select("id, avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!me) return { ok: false, error: "We couldn't find your member record." }

  const { error } = await supabase.from("members").update({ avatar_url: null }).eq("id", me.id)
  if (error) {
    console.log("[v0] removeAvatar update error:", error.message)
    return { ok: false, error: "We couldn't remove your picture. Please try again." }
  }

  const previous = pathFromPublicUrl(me.avatar_url)
  if (previous) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove([previous])
    if (rmError) console.log("[v0] removeAvatar could not remove file:", rmError.message)
  }

  revalidateAvatar()
  return { ok: true }
}
