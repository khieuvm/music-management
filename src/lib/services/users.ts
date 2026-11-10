import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { assertManager, type Actor } from "@/lib/access";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";
import { assertNotSharedDemoAccount } from "@/lib/demo";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { normalizeUsername } from "@/lib/services/auth";

const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;

function checkUsername(value: string) {
  const username = normalizeUsername(value);
  if (!USERNAME_RE.test(username)) {
    throw new RequestError(422, "Tên đăng nhập 3–50 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.");
  }
  return username;
}

/** Staff may manage student and teacher accounts; only admins manage staff/admin accounts. */
function assertCanManageRole(actor: Actor, role: Role) {
  assertManager(actor);
  if ((role === "ADMIN" || role === "STAFF") && actor.role !== "ADMIN") {
    throw new RequestError(403, "Chỉ quản lý được tạo hoặc thay đổi tài khoản giáo vụ/quản lý.");
  }
}

async function ensureUsernameFree(db: PrismaClient, username: string) {
  if (await db.user.findUnique({ where: { username }, select: { id: true } })) {
    throw new RequestError(409, `Tên đăng nhập “${username}” đã được dùng.`);
  }
}

export async function createStudentAccount(db: PrismaClient, actor: Actor, studentId: string, usernameInput?: string) {
  assertCanManageRole(actor, "STUDENT");
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) throw new RequestError(404, "Không tìm thấy học sinh.");
  if (student.userId) throw new RequestError(409, "Học sinh này đã có tài khoản.");
  const username = checkUsername(usernameInput || student.code);
  await ensureUsernameFree(db, username);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, passwordHash, role: "STUDENT", displayName: student.fullName },
    });
    const updated = await tx.student.updateMany({ where: { id: student.id, userId: null }, data: { userId: user.id } });
    if (updated.count !== 1) throw new RequestError(409, "Học sinh này vừa được tạo tài khoản.");
    await audit(tx, actor, "user.created", "User", user.id, { role: "STUDENT", studentId });
  });
  return { username, temporaryPassword };
}

export async function createTeacherAccount(db: PrismaClient, actor: Actor, teacherId: string, usernameInput: string) {
  assertCanManageRole(actor, "TEACHER");
  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) throw new RequestError(404, "Không tìm thấy giáo viên.");
  if (teacher.userId) throw new RequestError(409, "Giáo viên này đã có tài khoản.");
  const username = checkUsername(usernameInput);
  await ensureUsernameFree(db, username);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, passwordHash, role: "TEACHER", displayName: teacher.fullName },
    });
    const updated = await tx.teacher.updateMany({ where: { id: teacher.id, userId: null }, data: { userId: user.id } });
    if (updated.count !== 1) throw new RequestError(409, "Giáo viên này vừa được tạo tài khoản.");
    await audit(tx, actor, "user.created", "User", user.id, { role: "TEACHER", teacherId });
  });
  return { username, temporaryPassword };
}

export async function createStaffAccount(
  db: PrismaClient, actor: Actor, input: { username: string; displayName: string; role: "ADMIN" | "STAFF" },
) {
  assertCanManageRole(actor, input.role);
  const username = checkUsername(input.username);
  await ensureUsernameFree(db, username);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, passwordHash, role: input.role, displayName: input.displayName },
    });
    await audit(tx, actor, "user.created", "User", user.id, { role: input.role });
  });
  return { username, temporaryPassword };
}

async function loadManagedUser(db: PrismaClient, actor: Actor, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new RequestError(404, "Không tìm thấy tài khoản.");
  assertCanManageRole(actor, user.role);
  return user;
}

export async function resetPassword(db: PrismaClient, actor: Actor, userId: string) {
  const user = await loadManagedUser(db, actor, userId);
  if (user.id === actor.userId) throw new RequestError(422, "Hãy dùng chức năng đổi mật khẩu cho tài khoản của bạn.");
  assertNotSharedDemoAccount(user.username);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, actor, "user.password_reset", "User", user.id);
  });
  return { username: user.username, temporaryPassword };
}

export async function setUserActive(db: PrismaClient, actor: Actor, userId: string, isActive: boolean) {
  const user = await loadManagedUser(db, actor, userId);
  if (user.id === actor.userId) throw new RequestError(422, "Không thể tự khóa tài khoản đang dùng.");
  if (!isActive) assertNotSharedDemoAccount(user.username);
  await db.$transaction(async (tx) => {
    if (!isActive && user.role === "ADMIN") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('active-admins'))`;
      const admins = await tx.user.count({ where: { role: "ADMIN", isActive: true, NOT: { id: user.id } } });
      if (admins === 0) throw new RequestError(422, "Cần giữ ít nhất một tài khoản quản lý đang hoạt động.");
    }
    await tx.user.update({ where: { id: user.id }, data: { isActive } });
    if (!isActive) await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, actor, isActive ? "user.unlocked" : "user.locked", "User", user.id);
  });
}

/** Creates the first admin from the command line; refuses when an admin already exists. */
export async function bootstrapAdmin(db: PrismaClient, input: { username: string; displayName: string; password: string }) {
  const username = checkUsername(input.username);
  if (input.password.length < 12) throw new RequestError(422, "Mật khẩu quản lý đầu tiên cần ít nhất 12 ký tự.");
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('active-admins'))`;
    if (await tx.user.count({ where: { role: "ADMIN" } })) throw new RequestError(409, "Đã có tài khoản quản lý.");
    const user = await tx.user.create({
      data: { username, passwordHash, role: "ADMIN", displayName: input.displayName, mustChangePassword: false },
    });
    await audit(tx, null, "user.bootstrap_admin", "User", user.id);
    return user.id;
  });
}
