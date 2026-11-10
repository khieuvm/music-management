/** Public base URL. On Render, RENDER_EXTERNAL_URL is provided automatically when APP_URL is not set. */
export function appUrl() {
  const value = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (!value) throw new Error("APP_URL is required.");
  return value;
}

export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "RequestError";
  }
}

export async function readJsonBody(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RequestError(415, "Biểu mẫu cần được gửi dưới dạng JSON.");
  }
  if (!request.body) throw new RequestError(400, "Biểu mẫu không có nội dung.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestError(413, "Nội dung gửi quá dài.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) throw new RequestError(400, "Nội dung biểu mẫu không hợp lệ.");
    throw error;
  }
}
