import { NextResponse, type NextRequest } from "next/server"
import { PIN_COOKIE, pinToken } from "@/lib/pin"

/** Sends visitors to /pin until they enter APP_PIN (no-op when APP_PIN is unset). */
export async function proxy(request: NextRequest) {
  const pin = process.env.APP_PIN
  if (!pin || request.nextUrl.pathname === "/pin") return NextResponse.next()
  if (request.cookies.get(PIN_COOKIE)?.value === (await pinToken(pin))) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = "/pin"
  url.search = ""
  url.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sounds/).*)"],
}
