import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmationLabel,
  homeReminders,
  isApproaching,
  needsAttention,
} from "../src/lib/reminders";
import type { Appointment } from "../src/lib/appointments";
import { mutationSchema } from "../src/lib/booking";
const now = "2026-10-28T10:00:00+05:30";
const visit = (patch: Partial<Appointment> = {}): Appointment => ({
  id: crypto.randomUUID(),
  revision: crypto.randomUUID(),
  clientName: "Fictional Client",
  phone: null,
  practitionerName: "Maya Shah",
  service: "Follow-up consultation",
  serviceId: "follow-up",
  durationMinutes: 30,
  startsAt: "2026-10-29T09:00:00+05:30",
  status: "Booked",
  cancelledAt: null,
  clientConfirmedAt: null,
  reminderDismissedAt: null,
  createdAt: now,
  updatedAt: now,
  ...patch,
});
test("24-hour reminder window is inclusive at 24h and exclusive once started", () => {
  assert.equal(
    isApproaching(visit({ startsAt: "2026-10-29T10:00:00+05:30" }), now),
    true,
  );
  assert.equal(
    isApproaching(visit({ startsAt: "2026-10-29T10:00:01+05:30" }), now),
    false,
  );
  assert.equal(isApproaching(visit({ startsAt: now }), now), false);
  assert.equal(
    isApproaching(visit({ startsAt: "2026-10-27T10:00:00+05:30" }), now),
    false,
  );
});
test("confirmed, completed, cancelled and no-show visits never need attention", () => {
  for (const patch of [
    { clientConfirmedAt: now },
    { status: "Done" as const },
    { status: "No-show" as const },
    { cancelledAt: now },
  ])
    assert.equal(needsAttention(visit(patch), now), false);
  assert.equal(needsAttention(visit(), now), true);
  assert.equal(confirmationLabel(visit({ status: "Done" }), now), null);
  assert.equal(
    confirmationLabel(visit({ clientConfirmedAt: now }), now),
    "Client confirmed",
  );
  assert.equal(confirmationLabel(visit(), now), "Awaiting confirmation");
});
test("multiple reminders are sorted; persistent dismissal does not hide staff attention", () => {
  const later = visit();
  const first = visit({ startsAt: "2026-10-28T12:00:00+05:30" });
  const hidden = visit({ reminderDismissedAt: now });
  const confirmed = visit({ clientConfirmedAt: now });
  assert.deepEqual(
    homeReminders([later, hidden, confirmed, first], now).map((a) => a.id),
    [first.id, later.id],
  );
  assert.equal(needsAttention(hidden, now), true);
  assert.equal(homeReminders([hidden], "2026-10-28T11:00:00+05:30").length, 0);
});
test("confirmation input requires reviewed appointment instant and rejects forged state", () => {
  const input = {
    action: "confirm",
    id: crypto.randomUUID(),
    expectedStartsAt: now,
    expectedRevision: crypto.randomUUID(),
  };
  assert.equal(mutationSchema.safeParse(input).success, true);
  assert.equal(
    mutationSchema.safeParse({ action: "confirm", id: input.id }).success,
    false,
  );
  assert.equal(
    mutationSchema.safeParse({ ...input, clientConfirmedAt: now }).success,
    false,
  );
  assert.equal(
    mutationSchema.safeParse({ ...input, action: "dismiss-reminder" }).success,
    true,
  );
});
