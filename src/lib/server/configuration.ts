import { AppError } from "./errors";
export function readConfiguration(env: Record<string, string | undefined>) {
  const {
    SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: key,
    DEMO_SESSION_SECRET: secret,
    APP_ORIGIN,
  } = env;
  const message =
    "Database setup required. Check SUPABASE_URL, server-only SUPABASE_SECRET_KEY, DEMO_SESSION_SECRET (32+ characters) and APP_ORIGIN, then apply all SQL migrations. See README.";
  if (!url || !key || !secret || secret.trim().length < 32 || !APP_ORIGIN)
    throw new AppError(503, message);
  try {
    const project = new URL(url),
      app = new URL(APP_ORIGIN);
    for (const value of [project, app]) {
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(
        value.hostname,
      );
      if (
        value.username ||
        value.password ||
        value.pathname !== "/" ||
        value.search ||
        value.hash ||
        (value.protocol !== "https:" &&
          !(local && value.protocol === "http:" && env.VERCEL !== "1"))
      )
        throw new Error();
    }
    const legacy = key.split(".");
    const validKey =
      (key.startsWith("sb_secret_") && key.length >= 20) ||
      (legacy.length === 3 &&
        JSON.parse(Buffer.from(legacy[1], "base64url").toString()).role ===
          "service_role");
    if (!validKey || secret !== secret.trim()) throw new Error();
    return { url: project.origin, key, secret, origin: app.origin };
  } catch {
    throw new AppError(503, message);
  }
}
