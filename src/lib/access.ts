import type { Role } from "@/generated/prisma/enums";
import { RequestError } from "@/lib/http";

export type Actor = {
  userId: string;
  role: Role;
  displayName: string;
  username: string;
  mustChangePassword: boolean;
  teacherId: string | null;
  studentId: string | null;
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Quản lý",
  STAFF: "Giáo vụ",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh / phụ huynh",
};

export function isManager(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "STAFF";
}

export function assertRole(actor: Actor, ...roles: Role[]) {
  if (!roles.includes(actor.role)) throw new RequestError(403, "Bạn không có quyền thực hiện thao tác này.");
}

export function assertManager(actor: Actor) {
  assertRole(actor, "ADMIN", "STAFF");
}

export function homePathFor(role: Role) {
  if (role === "TEACHER") return "/giao-vien";
  if (role === "STUDENT") return "/hoc-sinh";
  return "/quan-tri";
}
