"use client"

import { useEffect } from "react"

/**
 * Registers public/sw.js (production builds only: cache-first on dev chunks would
 * break hot reload) and, while online, asks it to re-cache the /offline screen so
 * it matches the deployed build.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (navigator.onLine) (reg.active ?? navigator.serviceWorker.controller)?.postMessage("refresh-offline")
      })
      .catch(() => {})
  }, [])
  return null
}
