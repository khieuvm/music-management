import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { RequestError } from "@/lib/http";

type Bucket = { count: number };
type Queryable = PrismaClient | Prisma.TransactionClient;

export function hashKey(value: string) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) throw new Error("RATE_LIMIT_SECRET is required.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Atomically counts one attempt for the key; throws 429 when the limit is exceeded. */
export async function consumeRateLimit(db: Queryable, key: string, limit: number, windowMinutes = 15, message?: string) {
  const [bucket] = await db.$queryRaw<Bucket[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, NOW() + make_interval(mins => ${windowMinutes}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW()
        THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW()
        THEN NOW() + make_interval(mins => ${windowMinutes}::int) ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count"
  `;
  if (!bucket || bucket.count > limit) {
    throw new RequestError(429, message ?? `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${windowMinutes} phút.`);
  }
}

/** Gives back one attempt, e.g. after a successful login so only failures accumulate. */
export async function releaseRateLimit(db: Queryable, key: string) {
  await db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${key} AND "count" <= 1`;
  await db.$executeRaw`UPDATE "RateLimitBucket" SET "count" = "count" - 1 WHERE "key" = ${key} AND "count" > 1`;
}
