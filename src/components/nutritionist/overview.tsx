"use client";
import { useState } from "react";
import { useBookings } from "@/components/client/booking-provider";
import {
  appointmentDate,
  appointmentTime,
  dateInPractice,
  type AppointmentStatus,
} from "@/lib/appointments";
import { sortAppointments } from "@/lib/booking";
import { ButtonLink, Icon, PageHeading } from "@/components/ui";
import { NeedsAttention } from "./needs-attention";
import { confirmationLabel } from "@/lib/reminders";

export function NutritionistOverview() {
  const { appointments, updateStatus, refresh, now } = useBookings();
  const [todayOnly, setTodayOnly] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const today = dateInPractice(now);
  const visible = sortAppointments(
    appointments.filter(
      (a) => !todayOnly || dateInPractice(a.startsAt) === today,
    ),
  );
  async function changeStatus(
    id: string,
    status: Exclude<AppointmentStatus, "Booked">,
  ) {
    setBusy(id);
    setMessage("");
    const result = await updateStatus(id, status);
    setBusy("");
    setFailed(!result.ok);
    setMessage(result.ok ? `Attendance saved as ${status}.` : result.error);
  }
  return (
    <>
      <div className="dashboard-heading">
        <PageHeading
          eyebrow="Your practice space"
          title="Space for meaningful care."
        >
          A calm overview of your shared demo calendar. Every record here is
          fictional.
        </PageHeading>
        <ButtonLink href="/nutritionist/new">
          <Icon name="plus" />
          Add a booking
        </ButtonLink>
      </div>
      <section className="practice-summary">
        <div>
          <p className="eyebrow">Your workspace calendar</p>
          <h2>{appointmentDate({ startsAt: now })}</h2>
          <p className="muted mt-2">
            Asia/Kolkata (IST) · Updates every 15 seconds
          </p>
        </div>
        {(["Booked", "Done", "No-show"] as const).map((status) => (
          <div className="summary-stat" key={status}>
            <strong>
              {
                appointments.filter(
                  (a) => a.status === status && !a.cancelledAt,
                ).length
              }
            </strong>
            <span>{status}</span>
          </div>
        ))}
      </section>
      <NeedsAttention />
      <section className="section-space">
        <div className="appointments-toolbar">
          <div className="segmented-control" aria-label="Filter schedule">
            <button
              aria-pressed={!todayOnly}
              onClick={() => setTodayOnly(false)}
            >
              All dates <span>{appointments.length}</span>
            </button>
            <button aria-pressed={todayOnly} onClick={() => setTodayOnly(true)}>
              Today
            </button>
          </div>
          <button
            className="button button-secondary"
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy("refresh");
              await refresh();
              setBusy("");
            }}
          >
            Refresh schedule
          </button>
        </div>
        <p className="small-note mb-5">
          Historical Booked records keep their original attendance status.
          Attendance can change once the consultation starts. Cancelled visits
          release their slot.
        </p>
        {message && (
          <p
            className={failed ? "form-error mb-5" : "feedback mb-5"}
            role={failed ? "alert" : "status"}
          >
            {message}
          </p>
        )}
        {visible.length ? (
          <div className="practice-list">
            {visible.map((a) => {
              const canChange =
                !a.cancelledAt &&
                a.status === "Booked" &&
                Date.parse(a.startsAt) <= Date.parse(now);
              const statusClass = a.cancelledAt
                ? "cancelled"
                : a.status.toLowerCase().replace("-", "");
              return (
                <article className="card practice-appointment" key={a.id}>
                  <div className="practice-client">
                    <span className="avatar" aria-hidden="true">
                      {a.clientName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <h3>{a.clientName}</h3>
                      <p>
                        {a.phone ? (
                          <a href={`tel:${a.phone}`}>{a.phone}</a>
                        ) : (
                          <span className="missing-phone">
                            Phone not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="practice-time">
                    <strong>{appointmentDate(a)}</strong>
                    <span>
                      {appointmentTime(a)} IST · {a.durationMinutes} min
                    </span>
                  </div>
                  <div className="practice-service">
                    {a.service}
                    <span>Online · {a.practitionerName}</span>
                    {confirmationLabel(a, now) && (
                      <span
                        className={`confirmation-pill ${a.clientConfirmedAt ? "is-confirmed" : "is-awaiting"}`}
                      >
                        {confirmationLabel(a, now)}
                      </span>
                    )}
                  </div>
                  <div className="practice-status">
                    <span className={`attendance-badge status-${statusClass}`}>
                      {a.cancelledAt ? "Cancelled" : a.status}
                    </span>
                    {a.cancelledAt && <small>Attendance: {a.status}</small>}
                  </div>
                  <label className="status-control">
                    <span className="sr-only">
                      Attendance for {a.clientName}, {appointmentDate(a)}{" "}
                      {appointmentTime(a)}
                    </span>
                    <select
                      value={a.status}
                      disabled={!canChange || Boolean(busy)}
                      onChange={(e) =>
                        void changeStatus(
                          a.id,
                          e.target.value as "Done" | "No-show",
                        )
                      }
                    >
                      <option value="Booked" disabled>
                        Update attendance
                      </option>
                      <option value="Done">Done</option>
                      <option value="No-show">No-show</option>
                    </select>
                    <small>
                      {busy === a.id
                        ? "Saving…"
                        : a.cancelledAt
                          ? "Cancelled"
                          : a.status !== "Booked"
                            ? "Attendance recorded"
                            : canChange
                              ? "Mark attendance"
                              : "Available after start"}
                    </small>
                  </label>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card empty-state">
            <div className="round-icon">
              <Icon name="calendar" />
            </div>
            <h2>
              {todayOnly
                ? "A little breathing room today."
                : "Your calendar is ready."}
            </h2>
            <p className="muted">
              {todayOnly
                ? "There are no consultations today. Choose All dates to see historical sample records and future visits."
                : "Add your first fictional booking to get started."}
            </p>
            <ButtonLink href="/nutritionist/new">Add a booking</ButtonLink>
          </div>
        )}
      </section>
      <p className="small-note mt-6">
        No login in this assignment demo. Client and practice views share this
        visitor’s isolated workspace, not other visitors’ records.
      </p>
    </>
  );
}
