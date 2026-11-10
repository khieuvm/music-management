import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/access";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { assertNotSharedDemoAccount } from "@/lib/demo";
import { RequestError } from "@/lib/http";
import { consumeRateLimit, hashKey, releaseRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/services/audit";

export const SESSION_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new RequestError(422, "Mật khẩu phải dài từ 8 đến 128 ký tự.");
  }
}

export async function login(db: PrismaClient, usernameInput: string, password: string, caller: string) {
  const username = normalizeUsername(usernameInput);
  const message = "Tên đăng nhập hoặc mật khẩu không đúng.";
  if (!username || !password || password.length > 128) throw new RequestError(401, message);
  const limitMessage = "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.";
  const userKey = `login:user:${hashKey(username)}`;
  const callerKey = `login:caller:${hashKey(caller)}`;
  await consumeRateLimit(db, userKey, 10, 15, limitMessage);
  await consumeRateLimit(db, callerKey, 30, 15, limitMessage);

  const user = await db.user.findUnique({ where: { username } });
  const valid = await verifyPassword(password, user?.passwordHash ?? await getDummyHash());
  if (!user || !valid || !user.isActive) throw new RequestError(401, message);
  // Successful sign-ins must not exhaust the shared caller budget (e.g. a whole center behind one IP).
  await releaseRateLimit(db, userKey);
  await releaseRateLimit(db, callerKey);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.$transaction([
    db.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt } }),
    db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  return { token, expiresAt, role: user.role };
}

export async function findActorByToken(db: PrismaClient, token: string): Promise<Actor | null> {
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true, role: true, displayName: true, username: true, isActive: true, mustChangePassword: true,
          teacher: { select: { id: true } },
          student: { select: { id: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  const { user } = session;
  return {
    userId: user.id,
    role: user.role,
    displayName: user.displayName,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    teacherId: user.role === "TEACHER" ? user.teacher?.id ?? null : null,
    studentId: user.role === "STUDENT" ? user.student?.id ?? null : null,
  };
}

export async function logout(db: PrismaClient, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function changeOwnPassword(
  db: PrismaClient, actor: Actor, currentPassword: string, newPassword: string, keepToken: string,
) {
  assertNotSharedDemoAccount(actor.username);
  validatePassword(newPassword);
  if (newPassword === currentPassword) throw new RequestError(422, "Mật khẩu mới phải khác mật khẩu hiện tại.");
  await consumeRateLimit(db, `password:${actor.userId}`, 10, 15);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!await verifyPassword(currentPassword, user.passwordHash)) {
    throw new RequestError(422, "Mật khẩu hiện tại không đúng.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await tx.session.deleteMany({ where: { userId: user.id, NOT: { tokenHash: hashToken(keepToken) } } });
    await audit(tx, actor, "user.password_changed", "User", user.id);
  });
}
