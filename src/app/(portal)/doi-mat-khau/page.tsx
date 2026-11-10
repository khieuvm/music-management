import { changePasswordAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { requireActor } from "@/lib/auth/session";

export const metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const actor = await requireActor(undefined, { allowPasswordChange: true });
  return (
    <section className="panel" style={{ maxWidth: 520 }}>
      <h1>Đổi mật khẩu</h1>
      {actor.mustChangePassword && <p className="status">Bạn đang dùng mật khẩu tạm. Vui lòng đặt mật khẩu mới để tiếp tục.</p>}
      <p className="muted">Mật khẩu từ 8 ký tự. Các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
      <ActionForm action={changePasswordAction} submitLabel="Lưu mật khẩu mới">
        <Field label="Mật khẩu hiện tại" name="currentPassword" type="password" autoComplete="current-password" required />
        <Field label="Mật khẩu mới" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <Field label="Nhập lại mật khẩu mới" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </ActionForm>
    </section>
  );
}
