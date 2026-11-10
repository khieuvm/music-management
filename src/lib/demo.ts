import { RequestError } from "@/lib/http";

/** Shared accounts created by prisma/seed.ts (password "demo12345"). */
export const DEMO_ACCOUNTS = [
  { username: "quanly", role: "Quản lý" },
  { username: "giaovu", role: "Giáo vụ" },
  { username: "gv.lan", role: "Giáo viên (piano)" },
  { username: "gv.minh", role: "Giáo viên (cờ vua)" },
  { username: "hs0001", role: "Học sinh / phụ huynh" },
  { username: "hs0002", role: "Học sinh / phụ huynh" },
] as const;
export const DEMO_PASSWORD = "demo12345";

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

/** On a public demo everyone shares these accounts, so nobody may lock the others out. */
export function assertNotSharedDemoAccount(username: string) {
  if (isDemoMode() && DEMO_ACCOUNTS.some((account) => account.username === username)) {
    throw new RequestError(403, "Đây là tài khoản demo dùng chung nên không thể đổi mật khẩu hoặc khóa. Hãy tạo tài khoản mới để thử chức năng này.");
  }
}
