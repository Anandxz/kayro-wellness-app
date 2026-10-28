import { AppError } from "./errors";
import { developmentDiagnostic } from "./diagnostics";
export const configurationNames = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "DEMO_SESSION_SECRET",
  "APP_ORIGIN",
] as const;
export function inspectConfiguration(env: Record<string, string | undefined>) {
  return configurationNames.map((name) => {
    const value = env[name];
    let reason = !value ? "missing" : "valid";
    if (value) {
      if (name === "SUPABASE_URL" || name === "APP_ORIGIN") {
        try {
          const url = new URL(value);
          const local = ["localhost", "127.0.0.1", "[::1]"].includes(
            url.hostname,
          );
          if (
            url.username ||
            url.password ||
            url.pathname !== "/" ||
            url.search ||
            url.hash
          )
            reason =
              "must-be-origin-without-credentials-path-query-or-fragment";
          else if (
            url.protocol !== "https:" &&
            !(local && url.protocol === "http:" && env.VERCEL !== "1")
          )
            reason = "https-required-except-local-development";
        } catch {
          reason = "invalid-url";
        }
      } else if (name === "DEMO_SESSION_SECRET") {
        if (value.trim().length < 32)
          reason = "must-have-at-least-32-characters";
        else if (value !== value.trim()) reason = "surrounding-whitespace";
      } else {
        if (value.startsWith("sb_publishable_"))
          reason = "publishable-key-is-not-a-server-secret";
        else if (value.startsWith("sbp_"))
          reason = "personal-access-token-is-not-a-project-api-key";
        else if (value.startsWith("sb_secret_")) {
          if (value.length < 20) reason = "server-secret-too-short";
        } else {
          try {
            const parts = value.split(".");
            if (parts.length !== 3) reason = "unrecognized-server-key-format";
            else if (
              JSON.parse(Buffer.from(parts[1], "base64url").toString()).role !==
              "service_role"
            )
              reason = "jwt-role-must-be-service_role";
          } catch {
            reason = "malformed-server-key";
          }
        }
      }
    }
    return { name, present: Boolean(value), valid: reason === "valid", reason };
  });
}
export function readConfiguration(env: Record<string, string | undefined>) {
  const report = inspectConfiguration(env);
  if (report.some((requirement) => !requirement.valid)) {
    developmentDiagnostic("configuration", { requirements: report });
    // Safe in production: fixed setting names/reason codes only. Never include
    // their values, provider errors or URLs. This makes masked Vercel settings
    // diagnosable without requiring secret readback or debug endpoints.
    const failedSettings = report
      .filter((requirement) => !requirement.valid)
      .map((requirement) => `${requirement.name} (${requirement.reason})`)
      .join(", ");
    throw new AppError(
      503,
      `Database setup required. Invalid or missing settings: ${failedSettings}. Check the server environment and restart or redeploy. See README.`,
    );
  }
  return {
    url: new URL(env.SUPABASE_URL!).origin,
    key: env.SUPABASE_SECRET_KEY!,
    secret: env.DEMO_SESSION_SECRET!,
    origin: new URL(env.APP_ORIGIN!).origin,
  };
}
