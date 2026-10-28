"use client";
import { homeReminders } from "@/lib/reminders";
import { AttendanceConfirmation } from "./attendance-confirmation";
import { useBookings } from "./booking-provider";
export function ClientReminders() {
  const { appointments, now } = useBookings();
  const reminders = homeReminders(appointments, now);
  if (!reminders.length) return null;
  return (
    <div className="reminder-list" aria-label="Approaching consultations">
      {reminders.map((appointment) => (
        <AttendanceConfirmation
          key={appointment.id}
          appointment={appointment}
          reminder
        />
      ))}
    </div>
  );
}
