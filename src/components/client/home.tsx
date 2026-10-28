"use client";
import { AppointmentCard } from "@/components/appointment-card";
import { ButtonLink, Icon } from "@/components/ui";
import { useBookings } from "./booking-provider";
import { EmptyState } from "./empty-state";
import { isUpcoming, sortAppointments } from "@/lib/booking";
import { ClientReminders } from "./reminders";
export function ClientHome() {
  const { appointments, now } = useBookings();
  const next = sortAppointments(
    appointments.filter((a) => isUpcoming(a, now)),
  )[0];
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">Your wellbeing, one day at a time</p>
          <h1>
            Welcome back.{" "}
            <span className="greeting-leaf">
              <Icon name="leaf" />
            </span>
          </h1>
          <p className="muted">
            A little space to pause. A little support to move forward.
          </p>
        </div>
        <span className="profile-circle" aria-label="Fictional demo workspace">
          K
        </span>
      </section>
      <ClientReminders />
      <div className="client-home-grid">
        <section className="next-visit">
          <div className="section-heading">
            <h2>Your next moment of care</h2>
          </div>
          {next ? (
            <AppointmentCard appointment={next} label="Your next appointment" />
          ) : (
            <EmptyState />
          )}
        </section>
        <section className="home-invitation">
          <div className="round-icon">
            <Icon name="leaf" />
          </div>
          <p className="eyebrow">Make time for you</p>
          <h2>
            Good things grow
            <br />
            with a little care.
          </h2>
          <p className="muted">
            Whether it’s your first step or your next check-in, we’re here to
            meet you where you are.
          </p>
          <ButtonLink href="/book">
            Book a consultation
            <Icon name="arrow" />
          </ButtonLink>
          <p className="small-note">Online · Personal · At your pace</p>
        </section>
      </div>
      <section className="care-note">
        <div className="round-icon">
          <Icon name="leaf" />
        </div>
        <div>
          <p className="eyebrow">A gentle reminder</p>
          <h2>Progress doesn’t have to be perfect.</h2>
          <p className="muted">
            Bring your questions, your small wins and your everyday challenges.
            There’s space for all of it.
          </p>
        </div>
      </section>
    </>
  );
}
