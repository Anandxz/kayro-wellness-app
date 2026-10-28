import "server-only";
import { createClient } from "@supabase/supabase-js";
import { consultationTypes } from "@/lib/booking";
import type { Appointment, AppointmentStatus } from "@/lib/appointments";

import { AppError } from "./errors";
import { readConfiguration } from "./configuration";
export { AppError } from "./errors";
export function config() {
  return readConfiguration(process.env);
}
export function database() {
  const env = config();
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
            : AbortSignal.timeout(8000),
        }),
    },
  });
}
export type AppointmentRow = {
  id: string;
  revision: string;
  client_name: string;
  phone: string | null;
  service_id: "initial" | "follow-up";
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  cancelled_at: string | null;
  client_confirmed_at: string | null;
  reminder_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};
export function mapAppointment(row: AppointmentRow): Appointment {
  const service = consultationTypes.find((s) => s.id === row.service_id)!;
  return {
    id: row.id,
    revision: row.revision,
    clientName: row.client_name,
    phone: row.phone,
    serviceId: row.service_id,
    service: service.title,
    practitionerName: "Maya Shah",
    startsAt: row.starts_at,
    durationMinutes: service.durationMinutes,
    status: row.status,
    cancelledAt: row.cancelled_at,
    clientConfirmedAt: row.client_confirmed_at,
    reminderDismissedAt: row.reminder_dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function databaseError(error: {
  code?: string;
  message?: string;
}): never {
  if (error.code === "40001")
    throw new AppError(
      409,
      "This appointment has changed. Refresh and review it before trying again.",
    );
  if (error.code === "23P01" || error.code === "23505")
    throw new AppError(
      409,
      "That time was just taken. Please choose another slot.",
    );
  if (error.code === "P0002")
    throw new AppError(404, error.message ?? "Record not found.");
  if (error.code === "P0001" || error.code === "22023")
    throw new AppError(
      error.message?.includes("Too many") ? 429 : 422,
      error.message ?? "Invalid change.",
    );
  // Never return provider errors, SQL, credentials or request payloads to browsers.
  throw new AppError(
    503,
    "The database is unavailable or migrations are missing. Please check setup and try again.",
  );
}
export async function listAppointments(workspace: string) {
  const db = database();
  const { data: session, error: sessionError } = await db
    .from("demo_workspaces")
    .select("id")
    .eq("id", workspace)
    .eq("is_template", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError) databaseError(sessionError);
  if (!session)
    throw new AppError(
      401,
      "Demo session expired. Reload to start a new workspace.",
    );
  const { data, error } = await db
    .from("appointments")
    .select(
      "id,revision,client_name,phone,service_id,starts_at,ends_at,status,cancelled_at,client_confirmed_at,reminder_dismissed_at,created_at,updated_at",
    )
    .eq("workspace_id", workspace)
    .order("starts_at")
    .limit(100);
  if (error) databaseError(error);
  return (data as AppointmentRow[]).map(mapAppointment);
}
