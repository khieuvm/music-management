import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, type Actor } from "@/lib/access";
import { audit } from "@/lib/services/audit";
import { text } from "@/lib/validation";

export const consultationUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTING", "ENROLLED", "CLOSED"]),
  staffNote: text(1000, "Ghi chú"),
});

export async function updateConsultation(db: PrismaClient, actor: Actor, id: string, raw: unknown) {
  assertManager(actor);
  const input = consultationUpdateSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.consultationRequest.update({ where: { id }, data: input });
    await audit(tx, actor, "consultation.updated", "ConsultationRequest", id, { status: input.status });
  });
}
