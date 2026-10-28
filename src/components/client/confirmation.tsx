"use client";
import { useSearchParams } from "next/navigation";
import { AppointmentCard } from "@/components/appointment-card";
import { ButtonLink, Icon, PageHeading } from "@/components/ui";
import { useBookings } from "./booking-provider";
import { AttendanceConfirmation } from "./attendance-confirmation";
import { isUpcoming } from "@/lib/booking";
export function BookingConfirmation({ id }: { id: string }) {
  const { appointments, now } = useBookings();
  const params = useSearchParams();
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment)
    return (
      <>
        <PageHeading
          eyebrow="This demo workspace"
          title="We couldn’t find that visit."
        >
          This appointment isn’t in your workspace. You can check your
          appointments or choose another time.
        </PageHeading>
        <ButtonLink href="/book">Book a consultation</ButtonLink>
      </>
    );
  const cancelled = Boolean(appointment.cancelledAt);
  const upcoming = isUpcoming(appointment, now);
  return (
    <div className="confirmation">
      <div className="confirmation-mark">
        <Icon name={cancelled ? "calendar" : "check"} />
      </div>
      <p className="eyebrow">
        {cancelled
          ? "Visit cancelled"
          : upcoming
            ? "Booking saved"
            : "Your consultation record"}
      </p>
      <h1>
        {cancelled
          ? "Your plans have changed."
          : !upcoming
            ? "A step in your care journey."
            : params.get("rescheduled")
              ? "Your new time is saved."
              : "Your session is booked."}
      </h1>
      <p className="muted">
        {cancelled
          ? "This visit has since been cancelled."
          : upcoming
            ? `We look forward to seeing you, ${appointment.clientName.split(" ")[0]}.`
            : "You can review the consultation details below."}
      </p>
      <div className="text-left mt-8">
        <AppointmentCard appointment={appointment} label="Your consultation" />
      </div>
      {upcoming &&
        params.get("rescheduled") &&
        !appointment.clientConfirmedAt && (
          <p className="reschedule-note">
            Your previous time is available again. Please confirm that this new
            time works for you.
          </p>
        )}
      <div className="text-left">
        <AttendanceConfirmation
          key={`${appointment.id}/${appointment.startsAt}`}
          appointment={appointment}
        />
      </div>
      <p className="small-note mt-5">
        Saved in your demo workspace · Reminders appear in the app only.
        <br />
        Your booking stays available after refreshing this page.
      </p>
      <div className="confirmation-actions">
        <ButtonLink href="/appointments">
          My appointments
          <Icon name="arrow" />
        </ButtonLink>
        <ButtonLink href="/" secondary>
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
