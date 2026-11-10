import "server-only";
import { requireActor } from "@/lib/auth/session";
import { RequestError } from "@/lib/http";

export async function requireTeacher() {
  const actor = await requireActor(["TEACHER"]);
  if (!actor.teacherId) throw new RequestError(403, "Tài khoản chưa gắn hồ sơ giáo viên.");
  return { actor, teacherId: actor.teacherId };
}
