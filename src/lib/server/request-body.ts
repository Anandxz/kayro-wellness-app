import { AppError } from "./errors";
export async function readJson(
  request: Request,
  limit = 4096,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new AppError(415, "Use application/json for this request.");
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Invalid JSON.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(413, "Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "Invalid JSON.");
  }
}
