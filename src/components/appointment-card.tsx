"use client";
import {
  appointmentDate,
  appointmentTime,
  type Appointment,
} from "@/lib/appointments";
import { Badge, ButtonLink, Icon } from "@/components/ui";
import { useBookings } from "@/components/client/booking-provider";
import { confirmationLabel } from "@/lib/reminders";

export function AppointmentCard({
  appointment,
  label = "Consultation",
}: {
  appointment: Appointment;
  label?: string;
}) {
  const { now } = useBookings();
  const intent = confirmationLabel(appointment, now);
  return (
    <article className="card appointment-card">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">{label}</p>
        <Badge muted={appointment.status !== "Booked"}>
          {appointment.cancelledAt ? "Cancelled" : appointment.status}
        </Badge>
      </div>
      <div className="appointment-content">
        <div className="date-tile">
          <Icon name="calendar" />
          <span>{appointmentDate(appointment)}</span>
        </div>
        <div className="flex-1">
          <h3>{appointment.service}</h3>
          <p className="muted mt-1">with {appointment.practitionerName}</p>
          {intent && (
            <span
              className={`confirmation-pill ${appointment.clientConfirmedAt ? "is-confirmed" : "is-awaiting"}`}
            >
              {intent}
            </span>
          )}
          <div className="appointment-meta">
            <span>
              <Icon name="clock" />
              {appointmentTime(appointment)} IST · {appointment.durationMinutes}{" "}
              min
            </span>
            <span>
              <Icon name="video" />
              Online consultation
            </span>
          </div>
        </div>
        <ButtonLink href={`/appointments/${appointment.id}`} secondary>
          View visit
          <Icon name="arrow" />
        </ButtonLink>
      </div>
    </article>
  );
}
