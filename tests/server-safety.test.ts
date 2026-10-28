import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfiguration } from "../src/lib/server/configuration";
import { readJson } from "../src/lib/server/request-body";
const good = {
  SUPABASE_URL: "https://fictional.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_local_validation_example",
  DEMO_SESSION_SECRET: "x".repeat(64),
  APP_ORIGIN: "https://kayro.example",
};
test("configuration rejects publishable keys, unsafe origins and weak secrets without exposing values", () => {
  assert.equal(readConfiguration(good).origin, good.APP_ORIGIN);
  for (const patch of [
    { SUPABASE_URL: "http://supabase.example" },
    { SUPABASE_SECRET_KEY: "sb_publishable_example" },
    { APP_ORIGIN: "https://kayro.example/extra" },
    { APP_ORIGIN: "https://user:password@kayro.example" },
    { APP_ORIGIN: "http://localhost:3000", VERCEL: "1" },
    { DEMO_SESSION_SECRET: "short" },
    { APP_ORIGIN: "not a URL" },
  ])
    assert.throws(
      () => readConfiguration({ ...good, ...patch }),
      (error) =>
        error instanceof Error &&
        error.message.startsWith("Database setup required") &&
        !error.message.includes("password@"),
    );
  assert.equal(
    readConfiguration({
      ...good,
      SUPABASE_URL: "http://127.0.0.1:54321",
      APP_ORIGIN: "http://localhost:3000",
    }).url,
    "http://127.0.0.1:54321",
  );
});
test("JSON requests validate media type, malformed JSON and actual streamed byte size", async () => {
  const request = (body: string, contentType = "application/json") =>
    new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
  assert.deepEqual(
    await readJson(
      request('{"action":"book"}', "application/json; charset=utf-8"),
    ),
    { action: "book" },
  );
  await assert.rejects(() => readJson(request("broken")), { status: 400 });
  await assert.rejects(() => readJson(request("{}", "text/plain")), {
    status: 415,
  });
  await assert.rejects(() => readJson(request("{}", "application/jsonp")), {
    status: 415,
  });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('"' + "é".repeat(3000) + '"'),
      );
      controller.close();
    },
  });
  const streamed = new Request("http://localhost/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(() => readJson(streamed), { status: 413 });
});
