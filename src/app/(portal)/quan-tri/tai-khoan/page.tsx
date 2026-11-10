import { createStaffAccountAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Field, Select } from "@/components/fields";
import { AccountPanel } from "@/components/portal/account-panel";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { roleLabels } from "@/lib/access";

export const metadata = { title: "Tài khoản nhân viên" };

export default async function StaffAccountsPage() {
  const actor = await requireActor(["ADMIN"]);
  const users = await getDb().user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: [{ role: "asc" }, { displayName: "asc" }] });
  return (
    <>
      <div className="page-head"><h1>Tài khoản quản lý & giáo vụ</h1></div>
      <p className="muted">Tài khoản giáo viên và học sinh được tạo trong trang chi tiết của từng người.</p>
      <details className="panel">
        <summary><strong>+ Tạo tài khoản nhân viên</strong></summary>
        <ActionForm action={createStaffAccountAction} submitLabel="Tạo tài khoản" resetOnSuccess>
          <div className="form-grid">
            <Field label="Tên hiển thị" name="displayName" required maxLength={100} />
            <Field label="Tên đăng nhập" name="username" required pattern="[a-z0-9._\-]{3,50}" maxLength={50} autoCapitalize="none" />
            <Select label="Vai trò" name="role" defaultValue="STAFF">
              <option value="STAFF">{roleLabels.STAFF}</option>
              <option value="ADMIN">{roleLabels.ADMIN}</option>
            </Select>
          </div>
        </ActionForm>
      </details>
      <div className="card-list">
        {users.map((user) => (
          <article className="panel" key={user.id}>
            <h2>{user.displayName} <span className="muted">· {roleLabels[user.role]}{user.id === actor.userId ? " (bạn)" : ""}</span></h2>
            {user.id === actor.userId ? <p className="muted">{user.username} — dùng “Đổi mật khẩu” ở đầu trang.</p>
              : <AccountPanel ownerId={user.id} user={user} />}
          </article>
        ))}
      </div>
    </>
  );
}
