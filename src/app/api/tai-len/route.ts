import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl, RequestError } from "@/lib/http";
import { consumeRateLimit } from "@/lib/rate-limit";
import { removeStoredFile, saveUpload } from "@/lib/storage";
import { detectVideoType, maxUploadBytes, VIDEO_TYPES } from "@/lib/video";

export const runtime = "nodejs";

function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanName(raw: string | null, type: string) {
  let name = "";
  try {
    name = decodeURIComponent(raw ?? "");
  } catch {
    name = "";
  }
  name = name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 200);
  return name || `video.${VIDEO_TYPES[type as keyof typeof VIDEO_TYPES].toLowerCase()}`;
}

/** Receives one video as the raw request body. Only students upload (homework); files start unattached. */
export async function POST(request: Request) {
  let storageKey: string | null = null;
  try {
    if (request.headers.get("origin") !== new URL(appUrl()).origin) {
      throw new RequestError(403, "Yêu cầu không được gửi từ website hợp lệ.");
    }
    const actor = await getActor();
    if (!actor) throw new RequestError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    if (actor.role !== "STUDENT" || actor.mustChangePassword) throw new RequestError(403, "Bạn không có quyền tải video lên.");
    const maxBytes = maxUploadBytes();
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > maxBytes) throw new RequestError(413, `Video vượt quá ${Math.round(maxBytes / 1024 / 1024)} MB. Hãy quay ngắn hơn hoặc giảm chất lượng.`);
    if (!request.body) throw new RequestError(400, "Chưa chọn video.");
    const db = getDb();
    await consumeRateLimit(db, `upload:${actor.userId}`, 30, 60, "Bạn đã tải lên quá nhiều video. Vui lòng thử lại sau.");

    const saved = await saveUpload(request.body, maxBytes);
    storageKey = saved.storageKey;
    if (saved.sizeBytes === 0) throw new RequestError(400, "File video rỗng.");
    const mimeType = detectVideoType(saved.head);
    if (!mimeType) throw new RequestError(415, "Chỉ nhận video MP4, MOV (iPhone) hoặc WebM.");
    const file = await db.storedFile.create({
      data: {
        ownerId: actor.userId,
        storageKey: saved.storageKey,
        originalName: cleanName(request.headers.get("x-file-name"), mimeType),
        mimeType,
        sizeBytes: BigInt(saved.sizeBytes),
      },
      select: { id: true, originalName: true },
    });
    storageKey = null;
    await removeOrphans(actor.userId).catch(() => undefined);
    return respond({ ok: true, id: file.id, name: file.originalName }, 201);
  } catch (error) {
    if (storageKey) await removeStoredFile(storageKey).catch(() => undefined);
    if (error instanceof RequestError) return respond({ ok: false, message: error.message }, error.status);
    console.error("Upload failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return respond({ ok: false, message: "Chưa tải được video lên. Vui lòng thử lại." }, 500);
  }
}

/** Uploads never attached to a submission within a day are deleted. */
async function removeOrphans(ownerId: string) {
  const db = getDb();
  const stale = await db.storedFile.findMany({
    where: { ownerId, submission: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } },
    select: { id: true, storageKey: true },
    take: 20,
  });
  for (const file of stale) {
    const { count } = await db.storedFile.deleteMany({ where: { id: file.id, submission: null } });
    if (count) await removeStoredFile(file.storageKey);
  }
}
