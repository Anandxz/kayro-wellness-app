import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { Icon, PreviewNotice } from "@/components/ui";
import { BookingGate } from "@/components/client/booking-provider";

export function AppShell({
  children,
  dashboard = false,
}: {
  children: ReactNode;
  dashboard?: boolean;
}) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link
            href={dashboard ? "/nutritionist" : "/"}
            className="brand"
            aria-label="Kayro home"
          >
            <span className="brand-mark">
              <Icon name="leaf" />
            </span>
            kayro<span className="brand-period">.</span>
          </Link>
          <Navigation dashboard={dashboard} />
          <Link
            className="role-switch"
            href={dashboard ? "/" : "/nutritionist"}
          >
            {dashboard ? "Client app" : "Practice space"}
            <Icon name="arrow" />
          </Link>
        </div>
      </header>
      <main id="main-content" className="main-container">
        <PreviewNotice interactive={!dashboard} />
        <BookingGate>{children}</BookingGate>
      </main>
      <footer className="site-footer">
        <span>Care that fits your life.</span>
        <span>Kayro · Nutrition & wellbeing</span>
      </footer>
    </div>
  );
}
