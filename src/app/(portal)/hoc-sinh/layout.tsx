import { requireActor } from "@/lib/auth/session";

export default async function StudentLayout({ children }: LayoutProps<"/hoc-sinh">) {
  const actor = await requireActor(["STUDENT"]);
  if (!actor.studentId) return <p className="status error">Tài khoản chưa được gắn với hồ sơ học sinh. Vui lòng liên hệ giáo vụ.</p>;
  return children;
}
