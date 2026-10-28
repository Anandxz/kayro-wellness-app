"use client";
import { useState } from "react";
import { AppointmentCard } from "@/components/appointment-card";
import { ButtonLink, Icon, PageHeading } from "@/components/ui";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { isUpcoming } from "@/lib/booking";
import { useBookings } from "./booking-provider";
import { AttendanceConfirmation } from "./attendance-confirmation";
export function VisitDetails({ id }: { id: string }) {
  const { appointments, cancel, now } = useBookings();
  const appointment = appointments.find((a) => a.id === id);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelRevision, setCancelRevision] = useState("");
  if (!appointment)
    return (
      <>
        <PageHeading
          eyebrow="This demo session"
          title="We couldn’t find that visit."
        >
          This appointment isn’t in your demo workspace. You can find your
          current visits below.
        </PageHeading>
        <ButtonLink href="/appointments">My appointments</ButtonLink>
      </>
    );
  const upcoming = isUpcoming(appointment, now);
  return (
    <>
      <PageHeading
        eyebrow="Your appointment"
        title={
          appointment.cancelledAt
            ? "A little more breathing room."
            : "Your space to check in."
        }
      >
        {appointment.cancelledAt
          ? "This demo consultation has been cancelled and its time is available again."
          : "Supportive conversations, practical next steps and time just for you."}
      </PageHeading>
      <AppointmentCard appointment={appointment} label="Visit details" />
      <div
        role={failed ? "alert" : "status"}
        className={
          message ? (failed ? "form-error mt-5" : "feedback mt-5") : ""
        }
      >
        {message}
      </div>
      <AttendanceConfirmation
        key={`${appointment.id}/${appointment.startsAt}`}
        appointment={appointment}
      />
      <div className="visit-details-grid">
        <section className="card details-panel">
          <h2>{upcoming ? "Before we meet" : "Your visit"}</h2>
          <p className="muted mt-3">
            {upcoming
              ? "Find a comfortable spot for your online consultation. Bring any questions you’d like to explore together."
              : "This visit is now in your past appointments. You can book another consultation whenever you’re ready."}
          </p>
          <dl className="detail-list">
            <div>
              <dt>Client</dt>
              <dd>{appointment.clientName}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{appointment.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>Online consultation</dd>
            </div>
          </dl>
          <p className="small-note">
            In-app reminders only. No call link, SMS or background notification
            is sent.
          </p>
        </section>
        <section className="card details-panel">
          <div className="round-icon">
            <Icon name="calendar" />
          </div>
          <h2 className="mt-4">Plans can change.</h2>
          <p className="muted mt-3 mb-6">
            {upcoming
              ? "Find a better time, or cancel this consultation. Your changes will appear across the client app."
              : "Your next moment of care is waiting when you are."}
          </p>
          {upcoming ? (
            <div className="action-stack">
              <ButtonLink href={`/appointments/${id}/reschedule`} secondary>
                Reschedule visit
              </ButtonLink>
              <AlertDialog
                open={cancelOpen}
                onOpenChange={(open) => {
                  if (!busy) {
                    setCancelOpen(open);
                    if (open) setCancelRevision(appointment.revision);
                    setMessage("");
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <button className="button button-quiet" disabled={busy}>
                    {busy ? "Cancelling…" : "Cancel appointment"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle className="dialog-title">
                    Cancel this consultation?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="muted mt-3">
                    Your time will become available again. You can book a new
                    consultation whenever you’re ready. This will update your
                    saved demo appointment.
                  </AlertDialogDescription>
                  {failed && message && (
                    <p className="form-error" role="alert">
                      {message}
                    </p>
                  )}
                  <div className="dialog-actions">
                    <AlertDialogCancel
                      className="button button-secondary"
                      disabled={busy}
                    >
                      Keep my visit
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="button button-danger"
                      disabled={busy}
                      onClick={async (event) => {
                        event.preventDefault();
                        setBusy(true);
                        setMessage("");
                        const result = await cancel(id, cancelRevision);
                        setBusy(false);
                        setFailed(!result.ok);
                        if (result.ok) setCancelOpen(false);
                        setMessage(
                          result.ok
                            ? "Appointment cancelled. Take care, and we’ll be here when you’re ready."
                            : result.error,
                        );
                      }}
                    >
                      {busy ? "Cancelling…" : "Yes, cancel visit"}
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <ButtonLink href="/book">Book a consultation</ButtonLink>
          )}
        </section>
      </div>
      <div className="mt-6">
        <ButtonLink href="/appointments" secondary>
          Back to appointments
        </ButtonLink>
      </div>
    </>
  );
}
