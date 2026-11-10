import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/access";
import { getActor } from "@/lib/auth/session";
import { RequestError } from "@/lib/http";

export type ActionState = { ok: boolean; message: string } | null;

/** Authorizes a Server Action. Pages guard navigation, but every mutation must re-check. */
export async function requireActionActor(roles?: Role[], options: { allowPasswordChange?: boolean } = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new RequestError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  if (actor.mustChangePassword && !options.allowPasswordChange) {
    throw new RequestError(403, "Vui lòng đổi mật khẩu trước khi tiếp tục.");
  }
  if (roles && !roles.includes(actor.role)) throw new RequestError(403, "Bạn không có quyền thực hiện thao tác này.");
  return actor;
}

function databaseErrorMessage(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : "";
  if (text.includes("Lesson_teacher_no_overlap")) return "Giáo viên đã có buổi dạy khác trùng thời gian.";
  if ((error as { code?: string })?.code === "P2002") return "Dữ liệu bị trùng với bản ghi đã có. Vui lòng kiểm tra lại.";
  return null;
}

export async function runAction(task: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await task();
    return { ok: true, message: message || "Đã lưu thay đổi." };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RequestError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    if (error instanceof RangeError) return { ok: false, message: error.message };
    const known = databaseErrorMessage(error);
    if (known) return { ok: false, message: known };
    console.error("Action failed", { name: error instanceof Error ? error.name : "UnknownError", code: (error as { code?: string })?.code });
    return { ok: false, message: "Chưa thể lưu. Vui lòng thử lại; nếu vẫn lỗi, hãy báo quản lý." };
  }
}

export function formObject(formData: FormData) {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  }
  return result;
}
