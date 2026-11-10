import { requireActor } from "@/lib/auth/session";

export default async function TeacherLayout({ children }: LayoutProps<"/giao-vien">) {
  const actor = await requireActor(["TEACHER"]);
  if (!actor.teacherId) return <p className="status error">Tài khoản chưa được gắn với hồ sơ giáo viên. Vui lòng liên hệ giáo vụ.</p>;
  return children;
}
