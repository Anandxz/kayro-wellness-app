export type AppointmentStatus = "Booked" | "Done" | "No-show";
export type Appointment = {
  id: string;
  revision: string;
  clientName: string;
  phone: string | null;
  practitionerName: string;
  service: string;
  serviceId: "initial" | "follow-up";
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  cancelledAt: string | null;
  clientConfirmedAt: string | null;
  reminderDismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export const practiceTimeZone = "Asia/Kolkata";
export function dateInPractice(date: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: practiceTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function appointmentDate(appointment: Pick<Appointment, "startsAt">) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: practiceTimeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(appointment.startsAt));
}
export function appointmentTime(appointment: Pick<Appointment, "startsAt">) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: practiceTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(appointment.startsAt));
}
