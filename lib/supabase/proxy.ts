import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { RECOVERY_COOKIE } from "@/lib/auth-recovery"

// "/g" is the personal guest-invitation landing page. It MUST stay public: the
// whole point is that someone with no account can scan a member's QR code and
// register. It exposes only the inviting member's name, company and photo, and
// its single write goes through a server action that re-validates the token.
const PUBLIC_PATHS = ["/auth", "/g/", "/_next", "/favicon.ico"]

const RETIRED_AUTH_PATHS = ["/auth/sign-up", "/auth/sign-up-success"]

export async function updateSession(request: NextRequest) {
  // When the redirect target Supabase was given is not in its allow-list, it
  // falls back to the project's Site URL and appends the failure as query
  // params. That lands on "/" where nothing reads them, so the member just sees
  // the app with a cryptic URL. Route any such landing to the real error page.
  const authErrorCode = request.nextUrl.searchParams.get("error_code")
  if (authErrorCode && !request.nextUrl.pathname.startsWith("/auth/error")) {
    const errorUrl = request.nextUrl.clone()
    errorUrl.pathname = "/auth/error"
    errorUrl.search = `?reason=${encodeURIComponent(authErrorCode)}`
    return NextResponse.redirect(errorUrl)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Self-serve account creation is retired — logins are provisioned by an admin.
  // The route files still exist and "/auth" is public, so without this a
  // stranger could still self-register. That matters because the member
  // directory is readable by any signed-in user, so an unwanted account would
  // expose all 41 members' names, emails and companies.
  if (RETIRED_AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    // Carry the intended destination so a deep link survives signing in. Email
    // nudges (e.g. "log this vous too") point at a prefilled form, and dropping
    // the query string here used to land the member on the home page with no
    // hint of what they had tapped.
    //
    // Only the path and query of the original request, never a caller-supplied
    // URL, so this cannot be used to bounce anyone off-site.
    const target = `${pathname}${request.nextUrl.search}`
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(target)}`
    return NextResponse.redirect(url)
  }

  // Members are provisioned on a shared temporary password, so until they have
  // chosen their own every route funnels to the set-password screen. Framework
  // assets are exempt or the page itself could not load.
  //
  // Someone arriving from a reset link needs the same treatment: they are
  // signed in but their password is still the one they forgot. The cookie is
  // what signals that, because a metadata flag written by the admin API would
  // not appear in the session JWT read just above.
  const isRecovering = request.cookies.get(RECOVERY_COOKIE)?.value === "1"
  const mustChangePassword = user?.user_metadata?.must_change_password === true || isRecovering
  const isAsset = pathname.startsWith("/_next") || pathname === "/favicon.ico"

  // The public guest page is exempt too. Without this, a member who happens to
  // still be on their temporary password gets bounced to the password screen
  // when they open their own invite link to check it — and, worse, so would a
  // guest who had ever signed in on that phone.
  if (mustChangePassword && !isAsset && !pathname.startsWith("/g/") && pathname !== "/auth/set-password") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/set-password"
    // Carried through the redirect so a member who reset their password is not
    // told they "signed in with a temporary password", which they did not.
    url.search = isRecovering ? "?reason=recovery" : ""
    return NextResponse.redirect(url)
  }

  // Conversely, once the password is set the screen has no purpose — send them
  // home rather than letting a bookmark strand them on it.
  if (!mustChangePassword && user && pathname === "/auth/set-password") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
