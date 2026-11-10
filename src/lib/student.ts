import "server-only";
import { requireActor } from "@/lib/auth/session";
import { RequestError } from "@/lib/http";

export async function requireStudent() {
  const actor = await requireActor(["STUDENT"]);
  if (!actor.studentId) throw new RequestError(403, "Tài khoản chưa gắn hồ sơ học sinh.");
  return { actor, studentId: actor.studentId };
}
