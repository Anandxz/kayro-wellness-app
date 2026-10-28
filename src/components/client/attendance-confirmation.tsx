"use client";
import { useState } from "react";
import type { Appointment } from "@/lib/appointments";
import { appointmentDate, appointmentTime } from "@/lib/appointments";
import { isUpcoming } from "@/lib/booking";
import { ButtonLink, Icon } from "@/components/ui";
import { useBookings } from "./booking-provider";

export function AttendanceConfirmation({
  appointment,
  reminder = false,
}: {
  appointment: Appointment;
  reminder?: boolean;
}) {
  const { now, confirm, dismissReminder } = useBookings();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  if (!isUpcoming(appointment, now)) return null;
  async function act(dismiss = false) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const result = await (dismiss
      ? dismissReminder(appointment.id, appointment.startsAt)
      : confirm(appointment.id, appointment.startsAt));
    setBusy(false);
    setFailed(!result.ok);
    setMessage(
      result.ok
        ? dismiss
          ? "Reminder tucked away. You can still confirm from your visit details."
          : "Thank you — your nutritionist knows you’re planning to attend."
        : result.error,
    );
  }
  return (
    <section
      className={`attendance-confirmation ${appointment.clientConfirmedAt ? "intent-confirmed" : ""}`}
      aria-label={`Attendance confirmation for ${appointment.clientName}, ${appointmentDate(appointment)} ${appointmentTime(appointment)}`}
    >
      <div className="intent-heading">
        <span className="round-icon">
          <Icon name={appointment.clientConfirmedAt ? "check" : "calendar"} />
        </span>
        <div>
          <p className="eyebrow">
            {appointment.clientConfirmedAt
              ? "Attendance confirmed"
              : reminder
                ? "A gentle reminder · Within 24 hours"
                : "Your plans"}
          </p>
          <h2>
            {appointment.clientConfirmedAt
              ? "We’re looking forward to seeing you."
              : "Are we still on for your session?"}
          </h2>
        </div>
      </div>
      <p className="intent-details">
        {appointmentDate(appointment)} · {appointmentTime(appointment)} IST
        <br />
        {appointment.service} with {appointment.practitionerName}
      </p>
      {!appointment.clientConfirmedAt && (
        <p className="muted text-sm mb-4">
          A quick yes helps us prepare for you. If life has shifted, it’s okay
          to find another time.
        </p>
      )}
      <div className="intent-actions">
        {!appointment.clientConfirmedAt && (
          <button className="button" disabled={busy} onClick={() => void act()}>
            {busy ? "Saving…" : "Yes, I’ll be there"}
            <Icon name="check" />
          </button>
        )}
        <ButtonLink
          href={`/appointments/${appointment.id}/reschedule`}
          secondary
        >
          Reschedule
        </ButtonLink>
        <ButtonLink href={`/appointments/${appointment.id}`} secondary>
          Manage visit / cancel
        </ButtonLink>
        {reminder && !appointment.clientConfirmedAt && (
          <button
            className="button button-quiet"
            disabled={busy}
            onClick={() => void act(true)}
          >
            Not now
          </button>
        )}
      </div>
      <p
        role={failed ? "alert" : "status"}
        className={
          message ? (failed ? "form-error" : "feedback mt-4") : "sr-only"
        }
      >
        {message}
      </p>
      {reminder && (
        <p className="small-note mt-4">
          Shown in the app only. No SMS, WhatsApp or background notification is
          sent.
        </p>
      )}
    </section>
  );
}
