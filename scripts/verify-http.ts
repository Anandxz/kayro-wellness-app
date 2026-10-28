// Production-server security smoke checks. No Supabase connection is emulated:
// the deliberately unreachable loopback URL is used only for failure testing.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import assert from "node:assert/strict";
import { signWorkspace } from "../src/lib/server/session-token";
async function main() {
  const portProbe = createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const port = (portProbe.address() as { port: number }).port;
  await new Promise<void>((resolve) => portProbe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`,
    secret = randomBytes(32).toString("hex");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    VERCEL: "0",
    SUPABASE_URL: "http://127.0.0.1:1",
    SUPABASE_SECRET_KEY: "sb_secret_HTTP_failure_fixture_only",
    DEMO_SESSION_SECRET: secret,
    APP_ORIGIN: origin,
  };
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    { env, windowsHide: true, stdio: "pipe" },
  );
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const signed = signWorkspace(randomUUID(), secret);
  async function request(
    path: string,
    body?: string,
    cookie?: string,
    requestOrigin: string = origin,
  ) {
    return fetch(`${origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      headers: {
        Origin: requestOrigin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: `kayro-demo-workspace=${cookie}` } : {}),
      },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(12000),
    });
  }
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await request("/")).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (attempt === 99) throw new Error(`Server failed to start: ${logs}`);
    }
    for (const path of [
      "/",
      "/book",
      "/appointments",
      "/nutritionist",
      "/nutritionist/new",
      "/manifest.webmanifest",
    ]) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-powered-by"), null);
    }
    assert.equal((await request("/dashboard")).status, 307);
    assert.equal((await request("/api/appointments")).status, 401);
    assert.equal(
      (await request("/api/appointments", undefined, `${signed}x`)).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/demo-session",
          "{}",
          undefined,
          "https://attacker.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/api/appointments",
          "{}",
          signed,
          "https://attacker.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("/api/appointments", "invalid-json", signed)).status,
      400,
    );
    assert.equal(
      (await request("/api/appointments", "x".repeat(5000), signed)).status,
      413,
    );
    assert.equal(
      (
        await request(
          "/api/appointments",
          JSON.stringify({ action: "cancel", id: randomUUID() }),
          signed,
        )
      ).status,
      400,
    );
    const unavailable = await request("/api/appointments", undefined, signed);
    assert.equal(unavailable.status, 503);
    const error = await unavailable.text();
    assert.ok(
      !error.includes(secret) && !error.includes(env.SUPABASE_SECRET_KEY!),
    );
    console.log(
      "Production HTTP checks passed: routes, redirects, security headers, cookie rejection, cross-origin rejection, input limits, missing revisions and safe database failure. No live Supabase verification performed.",
    );
  } finally {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "HTTP checks failed");
  process.exitCode = 1;
});
