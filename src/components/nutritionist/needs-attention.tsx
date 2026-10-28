"use client";
import { useBookings } from "@/components/client/booking-provider";
import { appointmentDate, appointmentTime } from "@/lib/appointments";
import { sortAppointments } from "@/lib/booking";
import { needsAttention } from "@/lib/reminders";
import { ButtonLink, Icon } from "@/components/ui";
export function NeedsAttention() {
  const { appointments, now } = useBookings();
  const visits = sortAppointments(
    appointments.filter((a) => needsAttention(a, now)),
  );
  return (
    <section className="attention-section" aria-labelledby="attention-heading">
      <div className="section-heading">
        <h2 id="attention-heading">
          Needs attention{" "}
          <span className="attention-count">{visits.length}</span>
        </h2>
        <span className="small-note">
          Within 24 hours · Awaiting client confirmation
        </span>
      </div>
      {visits.length ? (
        <div className="attention-list">
          {visits.map((a) => (
            <article className="attention-item" key={a.id}>
              <span className="round-icon">
                <Icon name="clock" />
              </span>
              <div className="attention-person">
                <h3>{a.clientName}</h3>
                <p>
                  {appointmentDate(a)} · {appointmentTime(a)} IST
                </p>
                <small>{a.phone ?? "Phone not provided"}</small>
              </div>
              <span className="confirmation-pill is-awaiting">
                Awaiting confirmation
              </span>
              <ButtonLink href={`/appointments/${a.id}`} secondary>
                View visit
              </ButtonLink>
            </article>
          ))}
        </div>
      ) : (
        <div className="attention-clear">
          <Icon name="leaf" />
          <p>
            No upcoming visits need a nudge right now.
            <span>
              Unconfirmed consultations within 24 hours will appear here.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
