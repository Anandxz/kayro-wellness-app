// Read-only LOCAL diagnostic. Outputs requirement statuses, never env values,
// provider messages, row contents, cookies or credentials. No mutation RPC calls.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readdir } from "node:fs/promises";
import {
  inspectConfiguration,
  readConfiguration,
} from "../src/lib/server/configuration";
import { safeDatabaseDiagnostic } from "../src/lib/server/diagnostics";
async function main() {
  const { loadEnvConfig } = createRequire(resolve("package.json"))("@next/env") as typeof import("@next/env");
  const production = process.argv.includes("--production");
  const { loadedEnvFiles } = loadEnvConfig(process.cwd(), !production, {
    info() {},
    error() {},
  });
  console.log(
    JSON.stringify({
      environmentMode: production ? "production" : "development",
      loadedFiles: loadedEnvFiles.map((file) => file.path),
    }),
  );
  const requirements = inspectConfiguration(process.env);
  console.log(JSON.stringify({ requirements }, null, 2));
  const files = (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  console.log(
    JSON.stringify({
      localMigrationFiles: files,
      appliedMigrationHistory:
        "not checked; schema evidence below does not establish migration-history entries",
    }),
  );
  if (requirements.some((item) => !item.valid)) {
    console.log(
      JSON.stringify({
        databaseConnection: "not tested: configuration validation failed",
        requiredTables: "not verified",
        requiredRPCs: "not verified",
        seedData: "not verified",
        demoWorkspaceInitialization: "not reached; no workspace was created",
      }),
    );
    process.exitCode = 1;
    return;
  }
  const env = readConfiguration(process.env);
  const db = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
  const checks = [
    [
      "demo_workspaces",
      "id,expires_at,is_template,mutation_window,mutation_count,created_at",
    ],
    [
      "appointments",
      "id,workspace_id,practitioner_id,client_name,phone,service_id,starts_at,ends_at,appointment_date,appointment_time,status,cancelled_at,created_at,updated_at,seed_key,client_confirmed_at,reminder_dismissed_at,revision",
    ],
  ];
  let valid = true;
  for (const [table, columns] of checks) {
    const { error, status } = await db
      .from(table)
      .select(columns, { head: true })
      .limit(0);
    console.log(
      JSON.stringify({
        requirement: `${table}: required columns and SELECT access`,
        valid: !error,
        ...(error ? safeDatabaseDiagnostic({ code: error.code, status }) : {}),
      }),
    );
    if (error) valid = false;
  }
  // OpenAPI metadata checks RPC visibility/signatures WITHOUT executing writes.
  try {
    const response = await fetch(`${env.url}/rest/v1/`, {
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        Accept: "application/openapi+json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error();
    const metadata = await response.json();
    for (const name of [
      "create_demo_workspace",
      "mutate_appointment_checked",
    ]) {
      const present = Boolean(metadata.paths?.[`/rpc/${name}`]);
      console.log(
        JSON.stringify({ requirement: `${name}: API-visible RPC`, present }),
      );
      if (!present) valid = false;
    }
  } catch {
    console.log(
      JSON.stringify({
        requirement: "RPC metadata",
        valid: false,
        reason: "not verified: OpenAPI metadata unavailable",
      }),
    );
    valid = false;
  }
  const template = "00000000-0000-0000-0000-000000000000";
  const { error: templateError, count: templateCount } = await db
    .from("demo_workspaces")
    .select("id", { head: true, count: "exact" })
    .eq("id", template)
    .eq("is_template", true);
  const { error: seedError, count: seedCount } = await db
    .from("appointments")
    .select("id", { head: true, count: "exact" })
    .eq("workspace_id", template)
    .not("seed_key", "is", null);
  const seedValid =
    !templateError && !seedError && templateCount === 1 && seedCount === 5;
  console.log(
    JSON.stringify({
      requirement: "template workspace and five seed records",
      valid: seedValid,
    }),
  );
  if (!seedValid) valid = false;
  console.log(
    JSON.stringify({
      demoWorkspaceInitialization:
        "not executed: it creates data; only prerequisites were checked",
      readOnlyChecksPassed: valid,
    }),
  );
  if (!valid) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "Diagnostic could not complete. No raw errors or environment values were printed. Check environment files and connectivity locally.",
  );
  process.exitCode = 1;
});
