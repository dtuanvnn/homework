import AppFrame from "@/components/layout/AppFrame"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>
}
