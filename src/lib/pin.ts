/** Cookie holding a hash of APP_PIN once the PIN was entered (see proxy.ts). */
export const PIN_COOKIE = "hh_pin"

export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`homework-hub:${pin}`)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
