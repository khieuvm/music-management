import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/access";

export function audit(
  tx: Prisma.TransactionClient,
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string,
  detail?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { actorId: actor?.userId ?? null, action, entityType, entityId, detail },
  });
}
