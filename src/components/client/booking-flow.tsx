"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge, ButtonLink, Icon, PageHeading } from "@/components/ui";
import { appointmentDate, appointmentTime } from "@/lib/appointments";
import {
  consultationTypes,
  isUpcoming,
  validateDetails,
  type ServiceId,
} from "@/lib/booking";
import { useBookings } from "./booking-provider";
import { useAvailability } from "./use-availability";

export function BookingFlow({
  rescheduleId,
  manual = false,
}: {
  rescheduleId?: string;
  manual?: boolean;
}) {
  const { appointments, book, reschedule, dateOptions, now } = useBookings();
  const existing = appointments.find((a) => a.id === rescheduleId);
  const router = useRouter();
  const [serviceId, setServiceId] = useState<ServiceId>(
    existing?.serviceId ?? "initial",
  );
  const [date, setDate] = useState(dateOptions[0]);
  const [time, setTime] = useState("");
  const [name, setName] = useState(existing?.clientName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);
  const service = consultationTypes.find((s) => s.id === serviceId)!;
  const {
    slots,
    loading: slotsLoading,
    error: slotsError,
  } = useAvailability(date, serviceId, rescheduleId);
  const selected = slots.find((s) => s.startsAt === time && s.available);
  const selection = {
    startsAt: time,
    durationMinutes: service.durationMinutes,
  };
  const labels = rescheduleId
    ? ["Choose a new time", "Review your change"]
    : ["Choose your visit", "A little about you", "Review & confirm"];
  const reviewStep = labels.length - 1;
  function goTo(next: number) {
    setError("");
    setStep(next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || submitted.current) return;
    if (!selected) {
      setError("Please choose an available time.");
      setStep(0);
      return;
    }
    if (
      rescheduleId &&
      existing &&
      Date.parse(existing.startsAt) === Date.parse(time)
    ) {
      setError("Choose a different time for your visit.");
      return;
    }
    if (!rescheduleId && step === 1) {
      const message = validateDetails(name, phone);
      if (message) {
        setError(message);
        return;
      }
    }
    if (step < reviewStep) {
      goTo(step + 1);
      return;
    }
    const message = validateDetails(name, phone);
    if (message) {
      setError(message);
      if (!rescheduleId) setStep(1);
      return;
    }
    submitted.current = true;
    setBusy(true);
    const result = rescheduleId
      ? await reschedule(rescheduleId, time)
      : await book({ serviceId, startsAt: time, clientName: name, phone });
    if (!result.ok) {
      submitted.current = false;
      setBusy(false);
      setError(result.error);
      return;
    }
    router.push(
      manual
        ? "/nutritionist"
        : `/book/confirmation/${result.appointment.id}${rescheduleId ? "?rescheduled=1" : ""}`,
    );
  }
  if (rescheduleId && (!existing || !isUpcoming(existing, now)))
    return (
      <>
        <PageHeading eyebrow="Reschedule" title="Let’s check your visits.">
          This visit is no longer available to reschedule in your workspace.
        </PageHeading>
        <ButtonLink href="/appointments">My appointments</ButtonLink>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow={
          rescheduleId
            ? "A little flexibility"
            : manual
              ? "Practice space / Add booking"
              : "Make time for yourself"
        }
        title={
          rescheduleId
            ? "Find a better moment."
            : manual
              ? "Make room for a client."
              : "A small step towards feeling better."
        }
      >
        {rescheduleId
          ? "Your current time stays reserved until you confirm a new one."
          : "A supportive conversation, at a time that feels right for you."}
      </PageHeading>
      <div className="booking-layout">
        <div className="booking-main">
          <ol className="stepper" aria-label="Booking progress">
            {labels.map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
                className={index <= step ? "step-reached" : ""}
              >
                <span>{index < step ? <Icon name="check" /> : index + 1}</span>
                <small>{label}</small>
              </li>
            ))}
          </ol>
          <form className="card booking-panel" onSubmit={submit}>
            <div className="flex justify-between gap-4 items-center mb-6">
              <h2 ref={heading} tabIndex={-1}>
                {labels[step]}
              </h2>
              <span className="small-note">
                {step + 1} of {labels.length}
              </span>
            </div>
            {step === 0 && (
              <>
                <fieldset>
                  <legend className="field-label">
                    {rescheduleId
                      ? "Your consultation"
                      : "What would you like to book?"}
                  </legend>
                  <div className="service-choices">
                    {consultationTypes
                      .filter(
                        (s) => !rescheduleId || s.id === existing?.serviceId,
                      )
                      .map((s) => (
                        <label
                          className={`service-choice ${s.id === serviceId ? "selected" : ""}`}
                          key={s.id}
                        >
                          <input
                            type="radio"
                            name="service"
                            checked={s.id === serviceId}
                            value={s.id}
                            onChange={() => {
                              setServiceId(s.id);
                              setTime("");
                              setError("");
                            }}
                          />
                          <span>
                            <strong>{s.title}</strong>
                            <small>{s.description}</small>
                          </span>
                          <Badge muted>{s.durationMinutes} min</Badge>
                        </label>
                      ))}
                  </div>
                </fieldset>
                <fieldset className="mt-7">
                  <legend className="field-label">
                    Choose a date <span>· Next 14 days</span>
                  </legend>
                  <div className="date-options">
                    {dateOptions.map((day) => {
                      const parsed = new Date(`${day}T12:00:00+05:30`);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={day === date}
                          aria-label={new Intl.DateTimeFormat("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "full",
                          }).format(parsed)}
                          onClick={() => {
                            setDate(day);
                            setTime("");
                            setError("");
                          }}
                        >
                          <small>
                            {new Intl.DateTimeFormat("en-IN", {
                              weekday: "short",
                              timeZone: "Asia/Kolkata",
                            }).format(parsed)}
                          </small>
                          <strong>{day.slice(8)}</strong>
                          <small>
                            {new Intl.DateTimeFormat("en-IN", {
                              month: "short",
                              timeZone: "Asia/Kolkata",
                            }).format(parsed)}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="mt-7">
                  <legend className="field-label">
                    Available times <span>· India Standard Time (IST)</span>
                  </legend>
                  {slotsLoading ? (
                    <p role="status" className="small-note">
                      Checking availability…
                    </p>
                  ) : slotsError ? (
                    <p role="alert" className="form-error">
                      {slotsError} Try another date or refresh.
                    </p>
                  ) : slots.length ? (
                    <div className="time-options">
                      {slots.map((slot) => (
                        <button
                          key={slot.startsAt}
                          type="button"
                          disabled={
                            !slot.available ||
                            (rescheduleId !== undefined &&
                              Date.parse(slot.startsAt) ===
                                Date.parse(existing?.startsAt ?? ""))
                          }
                          aria-pressed={time === slot.startsAt}
                          aria-label={`${appointmentTime(slot)}${slot.available ? "" : ", unavailable"}`}
                          onClick={() => {
                            setTime(slot.startsAt);
                            setError("");
                          }}
                        >
                          {appointmentTime(slot)}
                          {Date.parse(slot.startsAt) ===
                            Date.parse(existing?.startsAt ?? "") && (
                            <small>Current time</small>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="availability-empty" role="status">
                      <Icon name="leaf" />
                      <p>
                        No times available on this date.
                        <br />
                        <span className="muted">
                          Try another day. There’s no rush.
                        </span>
                      </p>
                    </div>
                  )}
                  <p className="small-note mt-3">
                    {slots.length
                      ? "Unavailable times are disabled. Each visit is online with Maya Shah."
                      : "Sundays are a rest day. Please choose another date."}
                  </p>
                </fieldset>
              </>
            )}
            {!rescheduleId && step === 1 && (
              <div className="contact-fields">
                <p className="muted mb-6">
                  Just the essentials for your consultation. Please use
                  fictional details in this demo.
                </p>
                <label className="field-label" htmlFor="client-name">
                  Your name
                </label>
                <input
                  id="client-name"
                  autoComplete="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  aria-describedby={error ? "booking-error" : undefined}
                />
                <label className="field-label mt-5" htmlFor="client-phone">
                  Phone number
                </label>
                <input
                  id="client-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  name="phone"
                  required
                  maxLength={25}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 00000 00000"
                  aria-describedby="phone-help"
                />
                <p id="phone-help" className="small-note mt-2">
                  10–15 digits. No calls or messages will be sent.
                </p>
              </div>
            )}
            {step === reviewStep && (
              <>
                <p className="muted mb-5">
                  {rescheduleId
                    ? "A new time, the same thoughtful care. Check your change below."
                    : "Take a quick look. Everything feel right?"}
                </p>
                {rescheduleId && existing && (
                  <div className="previous-time">
                    <span className="eyebrow">Moving from</span>
                    <p>
                      {appointmentDate(existing)} · {appointmentTime(existing)}{" "}
                      IST
                    </p>
                  </div>
                )}
                <dl className="detail-list review-details">
                  <div>
                    <dt>Consultation</dt>
                    <dd>{service.title}</dd>
                  </div>
                  <div>
                    <dt>Nutritionist</dt>
                    <dd>Maya Shah</dd>
                  </div>
                  <div>
                    <dt>{rescheduleId ? "New date" : "Date"}</dt>
                    <dd>{appointmentDate(selection)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>
                      {appointmentTime(selection)} IST ·{" "}
                      {service.durationMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>Online consultation</dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{name.trim()}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{phone.trim()}</dd>
                  </div>
                </dl>
                <p className="small-note mt-5">
                  This fictional booking will be saved to your demo workspace.
                  No confirmation message will be sent.
                </p>
              </>
            )}
            {error && (
              <p className="form-error" id="booking-error" role="alert">
                {error}
              </p>
            )}
            <div className="booking-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => goTo(step - 1)}
                >
                  Back
                </button>
              )}
              <button
                className="button"
                type="submit"
                disabled={busy || (step === 0 && !selected)}
              >
                {busy
                  ? "Confirming…"
                  : step === reviewStep
                    ? rescheduleId
                      ? "Confirm new time"
                      : "Confirm booking"
                    : "Continue"}
                <Icon name={step === reviewStep ? "check" : "arrow"} />
              </button>
            </div>
          </form>
        </div>
        <aside className="booking-aside">
          <div className="round-icon">
            <Icon name="leaf" />
          </div>
          <p className="eyebrow mt-5">Care, without the pressure</p>
          <h2>
            A moment for you.
            <br />A plan for real life.
          </h2>
          <p className="muted">
            Come as you are. We’ll listen, explore your goals and find practical
            steps together.
          </p>
          <div className="aside-summary">
            <span className="field-label">Your visit</span>
            <strong>{service.title}</strong>
            <span className="muted">
              {service.durationMinutes} minutes · Online
            </span>
            {selected && (
              <span>
                {appointmentDate(selection)} · {appointmentTime(selection)} IST
              </span>
            )}
          </div>
          <p className="small-note">
            Live workspace availability · India Standard Time
          </p>
        </aside>
      </div>
    </>
  );
}
