import { NextResponse, type NextRequest } from "next/server"
import { grants, PIN_COOKIE, pinsFromEnv, roleForPath } from "@/lib/pin"

/**
 * Sends visitors to /pin until they enter the PIN of the mode they open:
 * /parent/* needs the parent PIN, /student/* the student PIN, other pages
 * either (see lib/pin.ts). No-op when no PIN is configured.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const pins = pinsFromEnv()
  if (pathname === "/pin" || (!pins.parent && !pins.student)) return NextResponse.next()

  const token = request.cookies.get(PIN_COOKIE)?.value
  const role = roleForPath(pathname)
  const allowed = role ? await grants(token, pins, role) : (await grants(token, pins, "parent")) || (await grants(token, pins, "student"))
  if (allowed) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = "/pin"
  url.search = ""
  url.searchParams.set("next", pathname)
  if (role) url.searchParams.set("role", role)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sounds/).*)"],
}
