import { z } from "zod";
import { readJson } from "@/lib/server/request-body";
export const runtime = "nodejs";
import { apiError, checkOrigin, workspace } from "@/lib/server/access";
import {
  AppError,
  database,
  databaseError,
  listAppointments,
  mapAppointment,
  type AppointmentRow,
} from "@/lib/server/database";
import {
  getAvailability,
  getDateOptions,
  mutationSchema,
  validStart,
} from "@/lib/booking";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const id = await workspace();
    const appointments = await listAppointments(id);
    const now = new Date();
    const query = new URL(request.url).searchParams;
    if (query.has("date")) {
      const parsed = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          serviceId: z.enum(["initial", "follow-up"]),
          excludeId: z.uuid().optional(),
        })
        .safeParse(Object.fromEntries(query));
      if (!parsed.success)
        throw new AppError(400, "Invalid availability request.");
      const { date, serviceId, excludeId } = parsed.data;
      if (excludeId && !appointments.some((a) => a.id === excludeId))
        throw new AppError(404, "Appointment not found.");
      return Response.json(
        {
          slots: getAvailability(date, serviceId, appointments, excludeId, now),
        },
        { headers },
      );
    }
    return Response.json(
      {
        appointments,
        now: now.toISOString(),
        dateOptions: getDateOptions(now),
      },
      { headers },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const id = await workspace();
    const json = await readJson(request);
    const parsed = mutationSchema.safeParse(json);
    if (!parsed.success)
      throw new AppError(400, parsed.error.issues[0].message);
    const input = parsed.data;
    if ("startsAt" in input && !validStart(input.startsAt))
      throw new AppError(
        422,
        "Choose an available future slot within 14 days, Monday–Saturday.",
      );
    const { data, error } = await database().rpc("mutate_appointment_checked", {
      p_workspace: id,
      p_action: input.action,
      ...("id" in input ? { p_id: input.id } : {}),
      ...("expectedRevision" in input
        ? { p_expected_revision: input.expectedRevision }
        : {}),
      ...("startsAt" in input ? { p_starts: input.startsAt } : {}),
      ...("expectedStartsAt" in input
        ? { p_starts: input.expectedStartsAt }
        : {}),
      ...(input.action === "book"
        ? {
            p_name: input.clientName,
            p_phone: input.phone,
            p_service: input.serviceId,
          }
        : {}),
      ...(input.action === "status" ? { p_status: input.status } : {}),
    });
    if (error) databaseError(error);
    const row = (data as AppointmentRow[])[0];
    if (!row)
      throw new AppError(
        503,
        "No appointment was returned. Refresh before trying again.",
      );
    return Response.json({ appointment: mapAppointment(row) }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
