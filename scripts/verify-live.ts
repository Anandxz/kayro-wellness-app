// End-to-end HTTP verification against a configured running Kayro app. Creates
// an isolated fictional workspace and no real patient data. No credentials used here.
import assert from "node:assert/strict";
async function main() {
  const origin = process.env.KAYRO_TEST_ORIGIN;
  if (!origin)
    throw new Error(
      "Set KAYRO_TEST_ORIGIN to a running, Supabase-configured Kayro origin.",
    );
  let cookie = "";
  const revisions = new Map<string, string>();
  async function call(path: string, body?: object) {
    const change = body as
      | { id?: string; expectedRevision?: string }
      | undefined;
    if (change?.id && !change.expectedRevision)
      body = { ...body, expectedRevision: revisions.get(change.id) };
    const response = await fetch(`${origin}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin!,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await response.json();
    for (const a of data.appointments ??
      (data.appointment ? [data.appointment] : []))
      revisions.set(a.id, a.revision);
    return { status: response.status, body: data };
  }
  assert.equal(
    (await call("/api/demo-session", {})).status,
    200,
    "Create workspace",
  );
  const initial = await call("/api/appointments");
  assert.equal(initial.status, 200);
  const seeds = initial.body.appointments;
  assert.equal(seeds.length, 5);
  assert.equal(
    seeds.find((a: { clientName: string }) => a.clientName === "Meera Iyer")
      .phone,
    null,
  );
  assert.deepEqual(
    seeds.map((a: { status: string }) => a.status).sort(),
    ["Booked", "Booked", "Booked", "Done", "No-show"].sort(),
  );
  let slots: { startsAt: string; available: boolean }[] = [];
  for (const date of initial.body.dateOptions) {
    const result = await call(
      `/api/appointments?${new URLSearchParams({ date, serviceId: "follow-up" })}`,
    );
    slots = result.body.slots.filter(
      (s: { available: boolean }) => s.available,
    );
    if (slots.length >= 4) break;
  }
  assert.ok(slots.length >= 4, "Need four available times");
  const payload = {
    action: "book",
    clientName: "Fictional HTTP Client",
    phone: "98200 99999",
    serviceId: "follow-up",
    startsAt: slots[0].startsAt,
  };
  const booked = await call("/api/appointments", payload);
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
  const id = booked.body.appointment.id;
  assert.equal(booked.body.appointment.clientConfirmedAt, null);
  const confirmed = await call("/api/appointments", {
    action: "confirm",
    id,
    expectedStartsAt: payload.startsAt,
  });
  assert.equal(confirmed.status, 200);
  assert.ok(confirmed.body.appointment.clientConfirmedAt);
  assert.ok(
    (await call("/api/appointments")).body.appointments.find(
      (a: { id: string }) => a.id === id,
    ).clientConfirmedAt,
    "Confirmation survives fresh read",
  );
  assert.ok(
    (await call("/api/appointments")).body.appointments.some(
      (a: { id: string }) => a.id === id,
    ),
    "Shared dashboard source contains client booking after fresh request",
  );
  assert.equal(
    (
      await call("/api/appointments", {
        ...payload,
        clientName: "Fictional Manual Client",
        startsAt: slots[1].startsAt,
      })
    ).status,
    200,
    "Manual booking uses same endpoint",
  );
  const moved = await call("/api/appointments", {
    action: "reschedule",
    id,
    startsAt: slots[2].startsAt,
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.appointment.id, id);
  assert.equal(
    moved.body.appointment.clientConfirmedAt,
    null,
    "New time needs reconfirmation",
  );
  assert.equal(
    (
      await call("/api/appointments", {
        action: "confirm",
        id,
        expectedStartsAt: payload.startsAt,
      })
    ).status,
    422,
    "Stale confirmation rejected",
  );
  assert.equal(
    (await call("/api/appointments", { action: "cancel", id })).status,
    200,
  );
  assert.equal(
    (
      await call("/api/appointments", {
        ...payload,
        startsAt: slots[2].startsAt,
      })
    ).status,
    200,
    "Cancelled time released",
  );
  const raced = await Promise.all([
    call("/api/appointments", { ...payload, startsAt: slots[3].startsAt }),
    call("/api/appointments", { ...payload, startsAt: slots[3].startsAt }),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
  const finalRows = (await call("/api/appointments")).body.appointments;
  for (const sample of seeds)
    assert.deepEqual(
      finalRows.find((a: { id: string }) => a.id === sample.id),
      sample,
      "Original sample records remain intact",
    );
  const savedCookie = cookie;
  cookie = "";
  assert.equal(
    (await call("/api/appointments")).status,
    401,
    "No cookie cannot read",
  );
  assert.equal((await call("/api/demo-session", {})).status, 200);
  assert.equal(
    (await call("/api/appointments")).body.appointments.length,
    5,
    "Other visitor has isolated seed workspace",
  );
  cookie = savedCookie;
  console.log(
    "Live HTTP verification passed: intact seeds, shared reads, manual/client writes, persisted confirmation, reconfirmation after reschedule, cancellation, concurrent conflict, and visitor isolation.",
  );
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Live verification failed.",
  );
  process.exitCode = 1;
});
