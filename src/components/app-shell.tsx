import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { Icon, PreviewNotice } from "@/components/ui";
import { BookingGate } from "@/components/client/booking-provider";
import { PreviewToggle } from "@/components/client/client-preview";

export function AppShell({
  children,
  dashboard = false,
}: {
  children: ReactNode;
  dashboard?: boolean;
}) {
  const shell = (
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
          <div className="header-actions">
            {!dashboard && <PreviewToggle />}
            <Link
              className="role-switch"
              href={dashboard ? "/" : "/nutritionist"}
            >
              {dashboard ? "Client app" : "Practice space"}
              <Icon name="arrow" />
            </Link>
          </div>
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
  return dashboard ? <div className="responsive-surface">{shell}</div> : shell;
}
