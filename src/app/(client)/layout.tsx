import { AppShell } from "@/components/app-shell";
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
