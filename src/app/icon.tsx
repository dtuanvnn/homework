import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
export const contentType = "image/png"

/** App icon: the indigo brand tile with a graduation cap, matching BrandMark. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4f46e5", borderRadius: 112, fontSize: 300 }}>
        🎓
      </div>
    ),
    size,
  )
}
