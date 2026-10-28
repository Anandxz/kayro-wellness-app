import { z } from "zod";
import { dateInPractice, type Appointment } from "./appointments";
export const consultationTypes = [
  {
    id: "initial",
    title: "Initial consultation",
    durationMinutes: 45,
    description: "Share your story and find a starting point that feels right.",
  },
  {
    id: "follow-up",
    title: "Follow-up consultation",
    durationMinutes: 30,
    description: "Celebrate small wins and gently adjust your plan.",
  },
] as const;
export type ServiceId = (typeof consultationTypes)[number]["id"];
export type ClientAppointment = Appointment;
export type BookingInput = {
  serviceId: ServiceId;
  startsAt: string;
  clientName: string;
  phone: string;
};
export type MutationResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; error: string };
export type Slot = { startsAt: string; available: boolean };
export const slotHours = [
  "09:00",
  "10:00",
  "11:00",
  "11:30",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
];

export function normalizePhone(value: string) {
  value = value.trim();
  if (!/^\+?\d[\d\s()-]*$/.test(value))
    throw new Error("Enter a valid phone number.");
  const digits = value.replace(/\D/g, "");
  const result = value.trim().startsWith("+")
    ? `+${digits}`
    : digits.length === 10
      ? `+91${digits}`
      : "";
  if (!/^\+[1-9][0-9]{9,14}$/.test(result))
    throw new Error(
      "Use a 10-digit Indian number or international number with country code.",
    );
  return result;
}
const phoneSchema = z
  .string()
  .max(30)
  .transform((value, ctx) => {
    try {
      return normalizePhone(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message:
          "Enter a valid phone number (10-digit Indian number or international with country code).",
      });
      return z.NEVER;
    }
  });
const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter a name of at least 2 characters.")
  .max(80);
const startsSchema = z.string().datetime({ offset: true });
export const mutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("confirm"),
      id: z.uuid(),
      expectedRevision: z.uuid(),
      expectedStartsAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      action: z.literal("dismiss-reminder"),
      id: z.uuid(),
      expectedRevision: z.uuid(),
      expectedStartsAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      action: z.literal("book"),
      clientName: nameSchema,
      phone: phoneSchema,
      serviceId: z.enum(["initial", "follow-up"]),
      startsAt: startsSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("reschedule"),
      id: z.uuid(),
      expectedRevision: z.uuid(),
      startsAt: startsSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("cancel"),
      id: z.uuid(),
      expectedRevision: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("status"),
      id: z.uuid(),
      expectedRevision: z.uuid(),
      status: z.enum(["Done", "No-show"]),
    })
    .strict(),
]);
export function validateDetails(name: string, phone: string) {
  const parsed = z
    .object({ name: nameSchema, phone: phoneSchema })
    .safeParse({ name, phone });
  return parsed.success ? null : parsed.error.issues[0].message;
}
export function getDateOptions(now: string | Date = new Date()) {
  const today = dateInPractice(now);
  return Array.from({ length: 15 }, (_, i) => {
    const date = new Date(`${today}T12:00:00+05:30`);
    date.setUTCDate(date.getUTCDate() + i);
    return dateInPractice(date);
  });
}
export function isUpcoming(a: Appointment, now: string | Date = new Date()) {
  return (
    a.status === "Booked" &&
    !a.cancelledAt &&
    Date.parse(a.startsAt) > new Date(now).getTime()
  );
}
export function sortAppointments<T extends Appointment>(
  appointments: readonly T[],
) {
  return [...appointments].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
}
export function overlaps(
  a: Pick<Appointment, "startsAt" | "durationMinutes">,
  b: Pick<Appointment, "startsAt" | "durationMinutes">,
) {
  return (
    Date.parse(a.startsAt) <
      Date.parse(b.startsAt) + b.durationMinutes * 60000 &&
    Date.parse(b.startsAt) < Date.parse(a.startsAt) + a.durationMinutes * 60000
  );
}
export function validStart(startsAt: string, now: Date = new Date()) {
  const instant = new Date(startsAt);
  if (!Number.isFinite(instant.getTime()) || instant <= now) return false;
  const day = dateInPractice(instant);
  const local = new Date(`${day}T12:00:00+05:30`);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return (
    getDateOptions(now).includes(day) &&
    local.getUTCDay() !== 0 &&
    slotHours.includes(time.slice(0, 5)) &&
    time.endsWith(":00") &&
    instant.getMilliseconds() === 0
  );
}
export function getAvailability(
  date: string,
  serviceId: ServiceId,
  appointments: readonly Appointment[],
  excludeId?: string,
  now: Date = new Date(),
): Slot[] {
  if (
    !getDateOptions(now).includes(date) ||
    new Date(`${date}T12:00:00+05:30`).getUTCDay() === 0
  )
    return [];
  const durationMinutes = consultationTypes.find(
    (s) => s.id === serviceId,
  )!.durationMinutes;
  return slotHours.map((hour) => {
    const startsAt = `${date}T${hour}:00+05:30`;
    return {
      startsAt,
      available:
        validStart(startsAt, now) &&
        !appointments.some(
          (a) =>
            a.id !== excludeId &&
            !a.cancelledAt &&
            overlaps({ startsAt, durationMinutes }, a),
        ),
    };
  });
}
