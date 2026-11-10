import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PRIVACY_VERSION, type ConsultationInput } from "@/lib/consultation-validation";
import { RequestError } from "@/lib/http";
import { consumeRateLimit, hashKey } from "@/lib/rate-limit";

const LIMIT_MESSAGE = "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 15 phút.";

function consumeBucket(tx: Prisma.TransactionClient, key: string, limit: number) {
  return consumeRateLimit(tx, key, limit, 15, LIMIT_MESSAGE);
}

export async function saveConsultation(db: PrismaClient, input: ConsultationInput, caller: string) {
  await db.$transaction(async (tx) => {
    const courseId = input.courseId || null;
    if (courseId) {
      const course = await tx.course.findFirst({
        where: { id: courseId, status: "PUBLISHED" },
        select: { id: true },
      });
      if (!course) throw new RequestError(422, "Khóa học không còn được công bố. Vui lòng chọn lại.");
    }

    await consumeBucket(tx, `caller:${hashKey(caller)}`, 5);
    await consumeBucket(tx, `phone:${hashKey(input.phone)}`, 3);
    await consumeBucket(tx, "consultation:global", 100);
    await tx.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await tx.consultationRequest.create({
      data: {
        contactName: input.contactName,
        phone: input.phone,
        note: input.note,
        courseId,
        privacyVersion: PRIVACY_VERSION,
        consentedAt: new Date(),
      },
    });
  });
}
