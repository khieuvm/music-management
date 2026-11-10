import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/access";

export type NotificationInput = { title: string; body?: string; href?: string };

/** Queues in-app notifications inside the caller's transaction; recipients without an account are skipped. */
export async function notify(
  tx: Prisma.TransactionClient, userIds: (string | null | undefined)[], input: NotificationInput, exceptUserId?: string,
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== exceptUserId))];
  if (!recipients.length) return 0;
  const { count } = await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId, title: input.title.slice(0, 200), body: (input.body ?? "").slice(0, 500), href: safeHref(input.href),
    })),
  });
  return count;
}

/** Only same-site relative paths are stored so a notification can never redirect elsewhere. */
export function safeHref(href: string | undefined) {
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return "";
  return href.slice(0, 300);
}

/** Account ids of students currently enrolled in a class. */
export async function classStudentUserIds(tx: Prisma.TransactionClient, classId: string) {
  const rows = await tx.enrollment.findMany({
    where: { classId, status: "ACTIVE" }, select: { student: { select: { userId: true } } },
  });
  return rows.map((row) => row.student.userId);
}

export async function teacherUserId(tx: Prisma.TransactionClient, teacherId: string) {
  return (await tx.teacher.findUnique({ where: { id: teacherId }, select: { userId: true } }))?.userId ?? null;
}

export function unreadCount(db: PrismaClient, actor: Actor) {
  return db.notification.count({ where: { userId: actor.userId, readAt: null } });
}

export function listNotifications(db: PrismaClient, actor: Actor, take = 50) {
  return db.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take });
}

/** Marks one notification (or all when id is omitted) as read; returns the target link if any. */
export async function markNotificationsRead(db: PrismaClient, actor: Actor, id?: string) {
  const now = new Date();
  if (!id) {
    await db.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: now } });
    return "";
  }
  if (!z.uuid().safeParse(id).success) return "";
  const item = await db.notification.findFirst({ where: { id, userId: actor.userId }, select: { id: true, href: true, readAt: true } });
  if (!item) return "";
  if (!item.readAt) await db.notification.update({ where: { id: item.id }, data: { readAt: now } });
  return safeHref(item.href);
}
