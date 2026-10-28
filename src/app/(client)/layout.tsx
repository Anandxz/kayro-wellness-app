import { AppShell } from "@/components/app-shell";
import { ClientPreview } from "@/components/client/client-preview";
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientPreview>
      <AppShell>{children}</AppShell>
    </ClientPreview>
  );
}
