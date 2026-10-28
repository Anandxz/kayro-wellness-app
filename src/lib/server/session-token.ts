import { createHmac, timingSafeEqual } from "node:crypto";
// Pure helper tested without importing Next or server-only.
export function signWorkspace(id: string, secret: string) {
  return `${id}.${createHmac("sha256", secret).update(id).digest("hex")}`;
}
export function verifyWorkspace(token: string | undefined, secret: string) {
  if (!token) return null;
  const [id, signature, extra] = token.split(".");
  if (
    extra ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id ?? "",
    ) ||
    !/^[0-9a-f]{64}$/.test(signature ?? "")
  )
    return null;
  const expected = signWorkspace(id, secret).split(".")[1];
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ? id
    : null;
}
