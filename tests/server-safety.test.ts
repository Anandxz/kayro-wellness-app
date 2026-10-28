import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectConfiguration,
  readConfiguration,
} from "../src/lib/server/configuration";
import {
  developmentDiagnostic,
  safeDatabaseDiagnostic,
} from "../src/lib/server/diagnostics";
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
test("configuration diagnostic identifies a publishable key without including its value", () => {
  const sentinel = "sb_publishable_sensitive_fixture_do_not_log";
  const report = inspectConfiguration({
    ...good,
    SUPABASE_SECRET_KEY: sentinel,
  });
  assert.deepEqual(
    report.find((item) => item.name === "SUPABASE_SECRET_KEY"),
    {
      name: "SUPABASE_SECRET_KEY",
      present: true,
      valid: false,
      reason: "publishable-key-is-not-a-server-secret",
    },
  );
  assert.equal(JSON.stringify(report).includes(sentinel), false);
  assert.throws(
    () => readConfiguration({ ...good, SUPABASE_SECRET_KEY: sentinel }),
    (error) =>
      error instanceof Error &&
      error.message.includes(
        "SUPABASE_SECRET_KEY (publishable-key-is-not-a-server-secret)",
      ) &&
      !error.message.includes(sentinel),
  );
  assert.equal(report.filter((item) => item.valid).length, 3);
});
test("database diagnostic preserves safe error codes, omits provider content, and stays off in production", () => {
  const provider = {
    code: "PGRST202",
    message: "secret=do-not-log",
    details: "private SQL and client data",
    status: 404,
  };
  const summary = safeDatabaseDiagnostic(provider);
  assert.equal(summary.code, "PGRST202");
  assert.match(summary.hint, /RPC/);
  assert.equal(JSON.stringify(summary).includes(provider.message), false);
  assert.equal(JSON.stringify(summary).includes(provider.details), false);
  assert.equal(
    safeDatabaseDiagnostic({ code: "sb_secret_private" }).code,
    "UNCLASSIFIED",
  );
  const oldEnvironment = process.env.NODE_ENV;
  const oldWarn = console.warn;
  const outputs: string[] = [];
  console.warn = (value) => outputs.push(String(value));
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    developmentDiagnostic("database", summary);
    assert.equal(outputs.length, 0);
    Object.assign(process.env, { NODE_ENV: "development" });
    developmentDiagnostic("database", summary);
    assert.equal(outputs.length, 1);
    assert.equal(outputs[0].includes(provider.message), false);
  } finally {
    console.warn = oldWarn;
    if (oldEnvironment === undefined)
      Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: oldEnvironment });
  }
});
