import { Readable } from "node:stream";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/page";
import { getAccessibleFile } from "@/lib/services/assignments";
import { openStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

function parseRange(header: string | null, size: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return start <= end && start < size ? { start, end } : "invalid";
}

/** Streams a stored video to users allowed to see it, with Range support for seeking. */
export async function GET(request: Request, { params }: RouteContext<"/api/tep/[id]">) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor || actor.mustChangePassword) return new Response("Unauthorized", { status: 401 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const file = await getAccessibleFile(getDb(), actor, id);
  if (!file) return new Response("Not found", { status: 404 });

  let stored;
  try {
    stored = await openStoredFile(file.storageKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  });
  const range = parseRange(request.headers.get("range"), stored.size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${stored.size}`);
    return new Response(null, { status: 416, headers });
  }
  const opened = await openStoredFile(file.storageKey, range ?? undefined);
  const body = Readable.toWeb(opened.stream()) as ReadableStream<Uint8Array>;
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stored.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(body, { status: 206, headers });
  }
  headers.set("Content-Length", String(stored.size));
  return new Response(body, { headers });
}
