import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { RequestError } from "@/lib/http";

export function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
}

function filePath(storageKey: string) {
  if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new Error("Invalid storage key");
  return path.join(storageRoot(), "uploads", storageKey);
}

/** Streams an upload to disk while enforcing the size limit; never buffers the whole file. */
export async function saveUpload(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const storageKey = randomUUID();
  const target = filePath(storageKey);
  const temporary = `${target}.part`;
  await mkdir(path.dirname(target), { recursive: true });
  let size = 0;
  const head: number[] = [];
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) {
        callback(new RequestError(413, `Video vượt quá dung lượng cho phép (${Math.round(maxBytes / 1024 / 1024)} MB).`));
        return;
      }
      for (let index = 0; head.length < 16 && index < chunk.length; index += 1) head.push(chunk[index]);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as WebReadableStream<Uint8Array>), counter, createWriteStream(temporary, { flags: "wx" }));
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { storageKey, sizeBytes: size, head: Uint8Array.from(head) };
}

export async function removeStoredFile(storageKey: string) {
  await rm(filePath(storageKey), { force: true });
}

export async function openStoredFile(storageKey: string, range?: { start: number; end: number }) {
  const target = filePath(storageKey);
  const info = await stat(target);
  return { size: info.size, stream: () => createReadStream(target, range) };
}
