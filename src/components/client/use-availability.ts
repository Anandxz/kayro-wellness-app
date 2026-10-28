"use client";
import { useEffect, useState } from "react";
import type { ServiceId, Slot } from "@/lib/booking";
import { useBookings } from "./booking-provider";
export function useAvailability(
  date: string,
  serviceId: ServiceId,
  excludeId?: string,
) {
  const { appointments } = useBookings();
  const [state, setState] = useState<{
    key: string;
    slots: Slot[];
    error: string;
  }>({ key: "", slots: [], error: "" });
  const key = `${date}/${serviceId}/${excludeId ?? ""}`;
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      date,
      serviceId,
      ...(excludeId ? { excludeId } : {}),
    });
    void fetch(`/api/appointments?${query}`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Availability could not be loaded.");
        if (!controller.signal.aborted)
          setState({ key, slots: data.slots, error: "" });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            key,
            slots: [],
            error:
              "We couldn’t check availability. Try another date or refresh before booking.",
          });
      });
    return () => controller.abort();
  }, [date, serviceId, excludeId, key, appointments]);
  return state.key === key
    ? { ...state, loading: false }
    : { slots: [], error: "", loading: true };
}
