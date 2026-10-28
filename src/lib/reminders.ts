import type { Appointment } from "./appointments";
import { isUpcoming, sortAppointments } from "./booking";
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export function isApproaching(appointment: Appointment, now: string | Date) {
  return (
    isUpcoming(appointment, now) &&
    Date.parse(appointment.startsAt) - new Date(now).getTime() <=
      REMINDER_WINDOW_MS
  );
}
export function needsAttention(appointment: Appointment, now: string | Date) {
  // Dismissal is a client display preference, not evidence of intent to attend.
  return isApproaching(appointment, now) && !appointment.clientConfirmedAt;
}
export function homeReminders(
  appointments: readonly Appointment[],
  now: string | Date,
) {
  return sortAppointments(
    appointments.filter(
      (a) => needsAttention(a, now) && !a.reminderDismissedAt,
    ),
  );
}
export function confirmationLabel(
  appointment: Appointment,
  now: string | Date,
) {
  if (!isUpcoming(appointment, now)) return null;
  return appointment.clientConfirmedAt
    ? "Client confirmed"
    : "Awaiting confirmation";
}
