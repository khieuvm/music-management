import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { homePathFor } from "@/lib/access";
import { getActor } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoMode } from "@/lib/demo";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false } };

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homePathFor(actor.role));
  return (
    <main id="main" className="container section">
      <div className="form-layout">
        <div>
          <p className="eyebrow">KHU VỰC HỌC SINH · GIÁO VIÊN · NHÂN VIÊN</p>
          <h1 className="page-title">Đăng nhập</h1>
          <p className="intro">Tài khoản do trung tâm cấp khi ghi danh. Phụ huynh dùng chung tài khoản của học sinh. Nếu quên mật khẩu, vui lòng liên hệ giáo vụ để được cấp lại.</p>
          {isDemoMode() && (
            <div className="panel demo-accounts">
              <h2>Bản demo — dữ liệu giả</h2>
              <p>Mật khẩu chung: <code>{DEMO_PASSWORD}</code>. Mọi người dùng chung các tài khoản này; vui lòng không nhập thông tin thật.</p>
              <ul>
                {DEMO_ACCOUNTS.map((account) => <li key={account.username}><code>{account.username}</code> — {account.role}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="panel">
          <ActionForm action={loginAction} submitLabel="Đăng nhập">
            <Field label="Tên đăng nhập" name="username" autoComplete="username" required maxLength={50} autoCapitalize="none" />
            <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required maxLength={128} />
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
