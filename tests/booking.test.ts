import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDateOptions,
  mutationSchema,
  normalizePhone,
  overlaps,
  validStart,
  isUpcoming,
} from "../src/lib/booking";
import { dateInPractice, type Appointment } from "../src/lib/appointments";
import {
  signWorkspace,
  verifyWorkspace,
} from "../src/lib/server/session-token";
const now = new Date("2026-10-28T09:00:00+05:30");
test("Indian and international phone normalization rejects missing or malformed input", () => {
  assert.equal(normalizePhone("98200 11111"), "+919820011111");
  assert.equal(normalizePhone("9820011111"), "+919820011111");
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  for (const value of [
    "",
    "missing phone",
    "1234",
    "abc9820011111",
    "+0000000000",
    "++919820011111",
    "98200+11111",
    "919820011111",
  ])
    assert.throws(() => normalizePhone(value));
});
test("server schema rejects forged ownership, unknown actions and invalid statuses", () => {
  const input = {
    action: "book",
    clientName: "Riya Shah",
    phone: "9820011111",
    serviceId: "initial",
    startsAt: "2026-10-29T10:00:00+05:30",
  };
  assert.equal(mutationSchema.safeParse(input).success, true);
  assert.equal(
    mutationSchema.safeParse({ ...input, workspace_id: crypto.randomUUID() })
      .success,
    false,
  );
  assert.equal(
    mutationSchema.safeParse({ ...input, serviceId: "invented" }).success,
    false,
  );
  assert.equal(
    mutationSchema.safeParse({
      action: "status",
      id: crypto.randomUUID(),
      status: "Cancelled",
    }).success,
    false,
  );
  assert.equal(
    mutationSchema.safeParse({ action: "delete", id: crypto.randomUUID() })
      .success,
    false,
  );
});
test("slots use actual IST dates, working hours, seconds and rolling horizon", () => {
  assert.equal(getDateOptions(now)[0], "2026-10-28");
  assert.equal(getDateOptions(now).at(-1), "2026-11-11");
  for (const date of ["2026-10-29T10:00:00+05:30", "2026-10-29T04:30:00Z"])
    assert.equal(validStart(date, now), true);
  for (const date of [
    "2026-10-29T10:15:00+05:30",
    "2026-10-29T10:00:01+05:30",
    "2026-10-29T10:00:00.001+05:30",
    "2026-11-01T10:00:00+05:30",
    "2026-11-12T10:00:00+05:30",
    "2026-10-20T10:00:00+05:30",
    "bad",
  ])
    assert.equal(validStart(date, now), false);
  assert.equal(dateInPractice("2026-10-28T20:00:00Z"), "2026-10-29");
});
test("past Booked records stay historical; cancellation is independent of attendance", () => {
  const a = {
    status: "Booked",
    cancelledAt: null,
    startsAt: "2026-10-24T10:00:00+05:30",
  } as Appointment;
  assert.equal(isUpcoming(a, now), false);
  assert.equal(a.status, "Booked");
  assert.equal(
    isUpcoming({ ...a, startsAt: "2026-10-29T10:00:00+05:30" }, now),
    true,
  );
  assert.equal(
    isUpcoming(
      {
        ...a,
        startsAt: "2026-10-29T10:00:00+05:30",
        cancelledAt: now.toISOString(),
      },
      now,
    ),
    false,
  );
});
test("half-open ranges allow adjacency and reject overlapping durations", () => {
  const a = { startsAt: "2026-10-29T10:00:00+05:30", durationMinutes: 45 };
  assert.equal(
    overlaps(a, { startsAt: "2026-10-29T10:30:00+05:30", durationMinutes: 30 }),
    true,
  );
  assert.equal(
    overlaps(a, { startsAt: "2026-10-29T10:45:00+05:30", durationMinutes: 30 }),
    false,
  );
});
test("signed workspace capabilities reject tampering and wrong secrets", () => {
  const id = crypto.randomUUID();
  const token = signWorkspace(id, "secret-one");
  assert.equal(verifyWorkspace(token, "secret-one"), id);
  assert.equal(verifyWorkspace(token, "secret-two"), null);
  assert.equal(
    verifyWorkspace(token.replace(id, crypto.randomUUID()), "secret-one"),
    null,
  );
  assert.equal(verifyWorkspace(undefined, "secret-one"), null);
  assert.equal(verifyWorkspace(`${token}.extra`, "secret-one"), null);
});
