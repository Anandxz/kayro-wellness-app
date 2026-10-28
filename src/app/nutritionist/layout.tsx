import { AppShell } from "@/components/app-shell";
export default function NutritionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell dashboard>{children}</AppShell>;
}
