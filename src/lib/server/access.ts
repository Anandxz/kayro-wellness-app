import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { AppError, config, database, databaseError } from "./database";
import { signWorkspace, verifyWorkspace } from "./session-token";
import { developmentDiagnostic } from "./diagnostics";
const COOKIE = "kayro-demo-workspace";
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== config().origin)
    throw new AppError(403, "This action must come from the Kayro demo.");
}
export async function workspace() {
  const jar = await cookies();
  const id = verifyWorkspace(jar.get(COOKIE)?.value, config().secret);
  if (!id)
    throw new AppError(
      401,
      "Start a demo session before accessing appointments.",
    );
  return id;
}
export async function startWorkspace() {
  const jar = await cookies();
  const env = config();
  const existing = verifyWorkspace(jar.get(COOKIE)?.value, env.secret);
  if (existing) {
    const { data, error } = await database()
      .from("demo_workspaces")
      .select("id")
      .eq("id", existing)
      .eq("is_template", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) databaseError(error, "workspace-read");
    if (data) return;
  }
  const id = randomUUID();
  const { error } = await database().rpc("create_demo_workspace", { p_id: id });
  if (error) databaseError(error, "workspace-create");
  jar.set(COOKIE, signWorkspace(id, env.secret), {
    httpOnly: true,
    secure: env.origin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
export function apiError(error: unknown) {
  const known = error instanceof AppError;
  if (!known)
    developmentDiagnostic("api-unexpected", {
      code: "UNEXPECTED",
      hint: "Unexpected server error. Raw error details are omitted to protect credentials and data.",
    });
  return Response.json(
    {
      error: known ? error.message : "Something went wrong. Please try again.",
    },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
