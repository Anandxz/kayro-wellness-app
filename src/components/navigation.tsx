"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

export function Navigation({ dashboard = false }: { dashboard?: boolean }) {
  const pathname = usePathname();
  const items = dashboard
    ? [
        { href: "/nutritionist", label: "Schedule", icon: "calendar" as const },
        {
          href: "/nutritionist/new",
          label: "Add booking",
          icon: "plus" as const,
        },
      ]
    : [
        { href: "/", label: "Home", icon: "home" as const },
        { href: "/book", label: "Book", icon: "plus" as const },
        {
          href: "/appointments",
          label: "Appointments",
          icon: "calendar" as const,
        },
      ];
  return (
    <nav
      aria-label={dashboard ? "Practice navigation" : "Client navigation"}
      className="primary-nav"
    >
      {items.map((item) => {
        const active =
          item.href === pathname ||
          (item.href === "/book" && pathname.startsWith("/book/")) ||
          (item.href === "/appointments" &&
            pathname.startsWith("/appointments/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "nav-link active" : "nav-link"}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
