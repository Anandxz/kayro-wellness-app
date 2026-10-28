"use client";
import { useState } from "react";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointment-card";
import { ButtonLink, PageHeading } from "@/components/ui";
import { isUpcoming, sortAppointments } from "@/lib/booking";
import { useBookings } from "./booking-provider";
import { EmptyState } from "./empty-state";
export function ClientAppointments() {
  const { appointments, now } = useBookings();
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const upcoming = sortAppointments(
    appointments.filter((a) => isUpcoming(a, now)),
  );
  const past = sortAppointments(
    appointments.filter((a) => !isUpcoming(a, now)),
  ).reverse();
  const visible = view === "upcoming" ? upcoming : past;
  return (
    <>
      <PageHeading eyebrow="Your care journey" title="Time well spent.">
        Your upcoming visits and the steps you’ve already taken, all in one
        place.
      </PageHeading>
      <div className="appointments-toolbar">
        <div className="segmented-control" aria-label="Filter appointments">
          <button
            aria-pressed={view === "upcoming"}
            onClick={() => setView("upcoming")}
          >
            Upcoming <span>{upcoming.length}</span>
          </button>
          <button
            aria-pressed={view === "past"}
            onClick={() => setView("past")}
          >
            Past <span>{past.length}</span>
          </button>
        </div>
        <ButtonLink href="/book" secondary>
          Book another visit
        </ButtonLink>
      </div>
      <div className="appointment-list" aria-live="polite">
        {visible.length ? (
          visible.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              label={
                view === "upcoming"
                  ? "Upcoming appointment"
                  : a.cancelledAt
                    ? "Cancelled visit"
                    : "Past visit"
              }
            />
          ))
        ) : (
          <EmptyState past={view === "past"} />
        )}
      </div>
      <p className="small-note mt-6">
        Fictional appointments · Saved in your private demo workspace.{" "}
        <Link href="/" className="text-link">
          Back home
        </Link>
      </p>
    </>
  );
}
