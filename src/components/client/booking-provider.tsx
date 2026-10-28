"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Appointment, AppointmentStatus } from "@/lib/appointments";
import type { BookingInput, MutationResult } from "@/lib/booking";

async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      init?.method === "POST"
        ? "We couldn’t confirm the result. Refresh your appointments before trying again."
        : "We couldn’t connect to your calendar. Check your connection and try again.",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Refresh before trying again.",
    );
  }
  if (!response.ok)
    throw new Error(
      body.error ?? "We couldn’t reach your appointments. Please try again.",
    );
  return body;
}
type BookingContextValue = {
  appointments: Appointment[];
  now: string;
  dateOptions: string[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  book: (input: BookingInput) => Promise<MutationResult>;
  reschedule: (id: string, startsAt: string) => Promise<MutationResult>;
  cancel: (id: string, expectedRevision?: string) => Promise<MutationResult>;
  confirm: (id: string, expectedStartsAt: string) => Promise<MutationResult>;
  dismissReminder: (
    id: string,
    expectedStartsAt: string,
  ) => Promise<MutationResult>;
  updateStatus: (
    id: string,
    status: Exclude<AppointmentStatus, "Booked">,
  ) => Promise<MutationResult>;
};
const BookingContext = createContext<BookingContextValue | null>(null);
export function BookingProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [now, setNow] = useState("");
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialized = useRef(false);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const starting = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      if (!initialized.current) {
        if (!starting.current)
          starting.current = request("/api/demo-session", {
            method: "POST",
            body: "{}",
          })
            .then(() => {
              initialized.current = true;
            })
            .finally(() => {
              starting.current = null;
            });
        await starting.current;
      }
      const version = generation.current;
      const data = await request("/api/appointments");
      if (version !== generation.current || sequence !== readSequence.current)
        return;
      setAppointments(data.appointments);
      setNow(data.now);
      setDateOptions(data.dateOptions);
      setError("");
    } catch (err) {
      if (sequence !== readSequence.current) return;
      initialized.current = false;
      setError(
        err instanceof Error ? err.message : "Couldn’t load appointments.",
      );
    } finally {
      if (sequence === readSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const focus = () => {
      void refresh();
    };
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  async function mutate(body: {
    id?: string;
    expectedRevision?: string;
    [key: string]: unknown;
  }): Promise<MutationResult> {
    generation.current++;
    try {
      const data = await request("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          ...(body.id
            ? {
                expectedRevision:
                  body.expectedRevision ??
                  appointments.find((a) => a.id === body.id)?.revision,
              }
            : {}),
        }),
      });
      const appointment = data.appointment as Appointment;
      generation.current++;
      setAppointments((previous) => [
        ...previous.filter((a) => a.id !== appointment.id),
        appointment,
      ]);
      setError("");
      void refresh();
      return { ok: true, appointment };
    } catch (err) {
      void refresh();
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Couldn’t save. Please refresh before trying again.",
      };
    }
  }
  return (
    <BookingContext.Provider
      value={{
        appointments,
        now,
        dateOptions,
        loading,
        error,
        refresh,
        book: (input) => mutate({ action: "book", ...input }),
        reschedule: (id, startsAt) =>
          mutate({ action: "reschedule", id, startsAt }),
        cancel: (id, expectedRevision) =>
          mutate({ action: "cancel", id, expectedRevision }),
        confirm: (id, expectedStartsAt) =>
          mutate({ action: "confirm", id, expectedStartsAt }),
        dismissReminder: (id, expectedStartsAt) =>
          mutate({ action: "dismiss-reminder", id, expectedStartsAt }),
        updateStatus: (id, status) => mutate({ action: "status", id, status }),
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
export function useBookings() {
  const context = useContext(BookingContext);
  if (!context) throw new Error("Screens require BookingProvider");
  return context;
}
export function BookingGate({ children }: { children: ReactNode }) {
  const { loading, error, refresh, now } = useBookings();
  if (loading)
    return (
      <section className="card placeholder" role="status">
        <div className="round-icon loading-pulse" />
        <h2>Making a little space…</h2>
        <p className="muted mt-3">Loading your appointments.</p>
      </section>
    );
  if (error && !now)
    return (
      <section className="card placeholder">
        <h2>Let’s get you connected.</h2>
        <p role="alert" className="muted mt-4 mb-6 max-w-xl mx-auto">
          {error}
        </p>
        <button className="button" onClick={() => void refresh()}>
          Try again
        </button>
        <p className="small-note mt-4">
          Bookings are not saved unless the database confirms them.
        </p>
      </section>
    );
  return (
    <>
      {error && (
        <div className="connection-warning" role="alert">
          <p>
            Your calendar couldn’t refresh. These details may be out of date.
            Changes still require database confirmation.
          </p>
          <button
            className="button button-secondary"
            onClick={() => void refresh()}
          >
            Retry refresh
          </button>
        </div>
      )}
      {children}
    </>
  );
}
