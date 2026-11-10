import { resetPasswordAction, setUserActiveAction } from "@/app/actions/manage";
import { ActionForm, type FormActionResult } from "@/components/action-form";
import { Badge, Field } from "@/components/fields";
import { formatDateTime } from "@/lib/time";

type Props = {
  ownerId: string;
  user: { id: string; username: string; isActive: boolean; lastLoginAt: Date | null; mustChangePassword: boolean } | null;
  createAction?: (formData: FormData) => Promise<FormActionResult>;
  defaultUsername?: string;
  usernameRequired?: boolean;
};

export function AccountPanel({ ownerId, user, createAction, defaultUsername, usernameRequired }: Props) {
  if (!user) {
    if (!createAction) return null;
    return (
      <ActionForm action={createAction} submitLabel="Tạo tài khoản đăng nhập" holdResult>
        <input type="hidden" name="id" value={ownerId} />
        <Field label="Tên đăng nhập" name="username" defaultValue={defaultUsername} required={usernameRequired}
          pattern="[a-z0-9._\-]{3,50}" maxLength={50} autoCapitalize="none" hint="Chữ thường không dấu, số, dấu chấm/gạch. Mật khẩu tạm sẽ hiện một lần." />
      </ActionForm>
    );
  }
  return (
    <div className="stack">
      <p>
        <strong>{user.username}</strong>{" "}
        <Badge tone={user.isActive ? "good" : "bad"}>{user.isActive ? "Đang hoạt động" : "Đã khóa"}</Badge>{" "}
        {user.mustChangePassword && <Badge tone="warn">Chưa đổi mật khẩu tạm</Badge>}
      </p>
      <p className="muted">Lần đăng nhập gần nhất: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "chưa đăng nhập"}</p>
      <div className="button-row">
        <ActionForm action={resetPasswordAction} submitLabel="Cấp lại mật khẩu tạm" holdResult confirmMessage="Cấp mật khẩu tạm mới và đăng xuất mọi thiết bị của tài khoản này?">
          <input type="hidden" name="userId" value={user.id} />
        </ActionForm>
        <ActionForm action={setUserActiveAction} submitLabel={user.isActive ? "Khóa tài khoản" : "Mở khóa"} danger={user.isActive}
          confirmMessage={user.isActive ? "Khóa tài khoản này? Người dùng sẽ bị đăng xuất ngay." : undefined}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="active" value={user.isActive ? "false" : "true"} />
        </ActionForm>
      </div>
    </div>
  );
}
