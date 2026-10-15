import { NextResponse, type NextRequest } from "next/server"
import { MODE_HEADER, PIN_COOKIE, parentPin, roleForPath } from "@/lib/pin"
import { sessionSecret, verifyToken } from "@/lib/session-token"

/**
 * Sends visitors to /pin until their signed cookie opens the mode of the path:
 * /student/* needs a student token (it names the child), /parent/* a parent
 * token unless no parent PIN is set. Stamps the mode on the request for the
 * shared layout (see server/access.ts). No database access here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(MODE_HEADER)
  if (pathname === "/pin") return NextResponse.next({ request: { headers: requestHeaders } })

  const session = await verifyToken(request.cookies.get(PIN_COOKIE)?.value, sessionSecret())
  const parentOpen = !parentPin()
  const role = roleForPath(pathname)
  const allowed =
    role === "student" ? session?.role === "student" : role === "parent" ? session?.role === "parent" || parentOpen : Boolean(session) || parentOpen
  if (allowed) {
    if (role) requestHeaders.set(MODE_HEADER, role)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const url = request.nextUrl.clone()
  url.pathname = "/pin"
  url.search = ""
  url.searchParams.set("next", pathname)
  url.searchParams.set("role", role ?? "student")
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sounds/).*)"],
}
