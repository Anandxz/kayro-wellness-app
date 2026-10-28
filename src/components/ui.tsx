import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Icon({
  name,
  className = "",
}: {
  name:
    | "leaf"
    | "home"
    | "calendar"
    | "arrow"
    | "clock"
    | "video"
    | "plus"
    | "check";
  className?: string;
}) {
  const paths = {
    leaf: (
      <>
        <path d="M19 4C9 2 3 7 5 14c2 7 14 6 14-10Z" />
        <path d="M5 20 15 9M9 16l-1-5m3 2 5 1" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 5h3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="12" height="12" rx="3" />
        <path d="m15 10 6-3v10l-6-3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      aria-hidden="true"
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function ButtonLink({
  children,
  secondary = false,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode; secondary?: boolean }) {
  return (
    <Link
      {...props}
      className={`button ${secondary ? "button-secondary" : ""} ${props.className ?? ""}`}
    >
      {children}
    </Link>
  );
}

export function Badge({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span className={`badge ${muted ? "badge-muted" : ""}`}>{children}</span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="muted mt-3 max-w-xl">{children}</p>}
    </div>
  );
}

export function PreviewNotice({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  return (
    <div className="preview-notice">
      <span className="status-dot" />
      {interactive ? "Fictional client demo" : "Fictional practice demo"}{" "}
      <span className="notice-detail">
        · Private demo workspace · All times IST
      </span>
    </div>
  );
}

export function Placeholder({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card placeholder">
      <div className="round-icon">
        <Icon name="calendar" />
      </div>
      <h2>{title}</h2>
      <p className="muted max-w-md mx-auto">{children}</p>
      <Badge muted>Coming in the next phase</Badge>
    </section>
  );
}
