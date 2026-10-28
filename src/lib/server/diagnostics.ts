export type DiagnosticStage =
  | "configuration"
  | "workspace-read"
  | "workspace-create"
  | "appointments-read"
  | "database"
  | "api-unexpected";
const hints: Record<string, string> = {
  "42P01": "Required table is missing.",
  PGRST205:
    "Table is unavailable to the API; check migrations, schema cache and grants.",
  "42703": "Required column is missing.",
  PGRST204: "Column is unavailable; check migrations and schema cache.",
  PGRST202:
    "RPC is unavailable; check migrations, schema cache and execute grants.",
  "42501": "Database permission denied; check server key and grants.",
  PGRST301: "API authentication failed.",
  PGRST302: "API authentication is required.",
};
export function safeDatabaseDiagnostic(error: {
  code?: string;
  status?: number;
}) {
  const code =
    error.code && /^[A-Z0-9]{5,12}$/.test(error.code)
      ? error.code
      : "UNCLASSIFIED";
  return {
    code,
    ...(Number.isInteger(error.status) ? { status: error.status } : {}),
    hint:
      hints[code] ??
      "Check connectivity, credentials and applied migrations. Raw provider errors are intentionally omitted.",
  };
}
const reported = new Set<string>();
export function developmentDiagnostic(stage: DiagnosticStage, summary: object) {
  if (process.env.NODE_ENV !== "development") return;
  // Only call with known, redacted summaries; never pass Error, env or request objects.
  const output = JSON.stringify({ stage, ...summary });
  if (reported.has(output)) return;
  reported.add(output);
  console.warn(`[Kayro server diagnostic] ${output}`);
}
