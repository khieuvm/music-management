import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { hashPassword } from "../../src/lib/auth/password";

const PASSWORD = "e2e-password-123";
const suffix = randomUUID().slice(0, 8);
const ids = {
  teacherUser: randomUUID(), teacher: randomUUID(), studentUser: randomUUID(), student: randomUUID(),
  course: randomUUID(), classGroup: randomUUID(), enrollment: randomUUID(), lesson: randomUUID(), assignment: randomUUID(),
  futureLesson: randomUUID(),
};
const names = { teacher: `gv.e2e.${suffix}`, student: `hs.e2e.${suffix}`, studentName: `Học sinh E2E ${suffix}`, assignment: `Bài E2E ${suffix}` };

async function db<T>(run: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function login(page: Page, username: string, password = PASSWORD, succeed = true) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (!succeed) return;
  const error = page.locator("main").getByRole("alert");
  await expect(error.or(page.locator(".portal-main"))).toBeVisible({ timeout: 15_000 });
  if (await error.isVisible()) throw new Error(`Login failed for ${username}: ${await error.textContent()}`);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await expect(page.getByLabel("Tên đăng nhập")).toBeVisible();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

/** Minimal MP4 signature; the server validates the container header, not the codec. */
function fakeMp4() {
  const header = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
  return Buffer.concat([header, Buffer.alloc(2048, 1)]);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const hash = await hashPassword(PASSWORD);
  const now = Date.now();
  await db(async (client) => {
    await client.query(`INSERT INTO "User" (id, username, "passwordHash", role, "displayName", "mustChangePassword", "updatedAt")
      VALUES ($1, $2, $3, 'TEACHER', 'GV E2E', false, now()), ($4, $5, $3, 'STUDENT', $6, false, now())`,
    [ids.teacherUser, names.teacher, hash, ids.studentUser, names.student, names.studentName]);
    await client.query(`INSERT INTO "Teacher" (id, "fullName", "userId", "updatedAt") VALUES ($1, 'GV E2E', $2, now())`, [ids.teacher, ids.teacherUser]);
    await client.query(`INSERT INTO "Student" (id, code, "fullName", "userId", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
      [ids.student, `E2E${suffix}`, names.studentName, ids.studentUser]);
    await client.query(`INSERT INTO "Course" (id, slug, title, summary, description, audience, category, subject, "updatedAt")
      VALUES ($1, $2, 'Khóa E2E', 'x', 'x', 'x', 'SKILL', 'Cờ vua', now())`, [ids.course, `e2e-${suffix}`]);
    await client.query(`INSERT INTO "ClassGroup" (id, code, name, "courseId", "teacherId", "deliveryMode", format, capacity, "tuitionVnd", "startDate", status, "updatedAt")
      VALUES ($1, $2, 'Lớp E2E', $3, $4, 'OFFLINE', 'GROUP', 5, 1000000, CURRENT_DATE - 7, 'ACTIVE', now())`,
    [ids.classGroup, `E2E-${suffix}`.toUpperCase(), ids.course, ids.teacher]);
    await client.query(`INSERT INTO "Enrollment" (id, "studentId", "classId", "tuitionVnd", "enrolledAt") VALUES ($1, $2, $3, 1000000, now() - interval '7 days')`,
      [ids.enrollment, ids.student, ids.classGroup]);
    await client.query(`INSERT INTO "Lesson" (id, "classId", "teacherId", "startsAt", "endsAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())`,
      [ids.lesson, ids.classGroup, ids.teacher, new Date(now - 90 * 60_000), new Date(now - 30 * 60_000)]);
    await client.query(`INSERT INTO "Lesson" (id, "classId", "teacherId", "startsAt", "endsAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())`,
      [ids.futureLesson, ids.classGroup, ids.teacher, new Date(now + 26 * 3_600_000), new Date(now + 27 * 3_600_000)]);
    await client.query(`INSERT INTO "Assignment" (id, "classId", title, instructions, "requireVideo", "createdById", "updatedAt")
      VALUES ($1, $2, $3, 'Quay video', true, $4, now())`, [ids.assignment, ids.classGroup, names.assignment, ids.teacherUser]);
  });
});

test.afterAll(async () => {
  await db(async (client) => {
    const files = await client.query(`SELECT "videoFileId" FROM "Submission" WHERE "assignmentId" = $1`, [ids.assignment]);
    await client.query(`DELETE FROM "Submission" WHERE "assignmentId" = $1`, [ids.assignment]);
    await client.query(`DELETE FROM "StoredFile" WHERE "ownerId" = $1 OR id = ANY($2::uuid[])`,
      [ids.studentUser, files.rows.map((row) => row.videoFileId).filter(Boolean)]);
    await client.query(`DELETE FROM "Assignment" WHERE id = $1`, [ids.assignment]);
    await client.query(`DELETE FROM "Attendance" WHERE "lessonId" = $1`, [ids.lesson]);
    await client.query(`DELETE FROM "AbsenceRequest" WHERE "lessonId" IN (SELECT id FROM "Lesson" WHERE "classId" = $1)`, [ids.classGroup]);
    await client.query(`DELETE FROM "StudentNote" WHERE "classId" = $1`, [ids.classGroup]);
    await client.query(`DELETE FROM "Lesson" WHERE "classId" = $1`, [ids.classGroup]);
    const enrollments = `SELECT id FROM "Enrollment" WHERE "classId" = $1`;
    await client.query(`DELETE FROM "Payment" WHERE "enrollmentId" IN (${enrollments})`, [ids.classGroup]);
    await client.query(`DELETE FROM "FeeInstallment" WHERE "enrollmentId" IN (${enrollments})`, [ids.classGroup]);
    await client.query(`DELETE FROM "Enrollment" WHERE "classId" = $1`, [ids.classGroup]);
    await client.query(`DELETE FROM "ClassGroup" WHERE id = $1`, [ids.classGroup]);
    await client.query(`DELETE FROM "Course" WHERE id = $1`, [ids.course]);
    await client.query(`DELETE FROM "Student" WHERE id = $1`, [ids.student]);
    await client.query(`DELETE FROM "Teacher" WHERE id = $1`, [ids.teacher]);
    await client.query(`DELETE FROM "User" WHERE id = ANY($1::uuid[])`, [[ids.teacherUser, ids.studentUser]]);
  });
});

test("roles are kept inside their own area", async ({ page }) => {
  await page.goto("/hoc-sinh");
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await login(page, names.student, "wrong-password", false);
  await expect(page.locator("main").getByRole("alert")).toContainText("không đúng");
  await login(page, names.student);
  await expect(page).toHaveURL(/\/hoc-sinh$/);
  await page.goto("/quan-tri");
  await expect(page).toHaveURL(/\/hoc-sinh$/);
  await page.goto("/giao-vien");
  await expect(page).toHaveURL(/\/hoc-sinh$/);
  expect((await page.request.get("/api/bao-cao/gio-day?tu=2026-01-01&den=2026-01-31")).status()).toBe(403);
});

test("teacher takes attendance and the comment reaches the student", async ({ page }) => {
  await login(page, names.teacher);
  await expect(page).toHaveURL(/\/giao-vien$/);
  await noHorizontalScroll(page);
  await page.goto(`/giao-vien/buoi/${ids.lesson}`);
  const row = page.getByRole("group", { name: new RegExp(names.studentName) });
  await row.getByLabel("Đi muộn").check();
  await row.getByLabel("Nhận xét cho học sinh / phụ huynh").fill("Đến muộn 10 phút, chơi tốt.");
  await page.getByLabel("Nội dung buổi học").fill("Khai cuộc Ý");
  await page.getByRole("button", { name: "Lưu điểm danh & xác nhận đã dạy" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã lưu điểm danh");
  await expect(page.locator("main").getByText("Đã dạy", { exact: true })).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto("/giao-vien/gio-day");
  await expect(page.getByRole("cell", { name: "GV E2E" })).toBeVisible();

  await logout(page);
  await login(page, names.student);
  await page.goto("/hoc-sinh/lich");
  await expect(page.getByText("Đến muộn 10 phút, chơi tốt.")).toBeVisible();
  await noHorizontalScroll(page);
});

test("student uploads a video and the teacher reviews it", async ({ page }) => {
  await login(page, names.student);
  await page.goto("/hoc-sinh/bai-tap");
  await page.getByRole("link", { name: names.assignment }).click();
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("cần nộp video");

  await page.getByLabel(/Video bài làm/).setInputFiles({ name: "not-video.mp4", mimeType: "video/mp4", buffer: Buffer.from("plain text") });
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Chỉ nhận video");

  await page.getByLabel(/Video bài làm/).setInputFiles({ name: "bai-tap.mp4", mimeType: "video/mp4", buffer: fakeMp4() });
  await page.getByLabel("Ghi chú gửi giáo viên").fill("Con tập 3 lần rồi ạ");
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã nộp bài");
  await expect(page.getByText("Chờ chấm")).toBeVisible();
  const src = await page.locator("video").getAttribute("src");
  expect(src).toMatch(/^\/api\/tep\//);
  const ranged = await page.request.get(src!, { headers: { Range: "bytes=0-15" } });
  expect(ranged.status()).toBe(206);
  expect(ranged.headers()["content-type"]).toBe("video/mp4");
  await noHorizontalScroll(page);

  const crossOrigin = await page.request.post("/api/tai-len", { headers: { Origin: "https://example.invalid" }, data: fakeMp4() });
  expect(crossOrigin.status()).toBe(403);

  await logout(page);
  expect((await page.request.get(src!)).status()).toBe(401);

  await login(page, names.teacher);
  await page.goto(`/giao-vien/bai-tap/${ids.assignment}`);
  await expect(page.locator("video")).toHaveAttribute("src", src!);
  await expect(page.getByText("Con tập 3 lần rồi ạ")).toBeVisible();
  await page.getByLabel("Kết quả").selectOption("NEEDS_REVISION");
  await page.getByLabel("Nhận xét cho học sinh").fill("Tay trái cần đều hơn, quay lại nhé.");
  await page.getByRole("button", { name: "Lưu nhận xét" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã lưu nhận xét");

  await logout(page);
  await login(page, names.student);
  await page.goto(`/hoc-sinh/bai-tap/${ids.assignment}`);
  await expect(page.getByText("Tay trái cần đều hơn, quay lại nhé.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nộp lại" })).toBeVisible();
});

test("manager enrolls a new student and issues a one-time password", async ({ page }) => {
  await login(page, "quanly", "demo12345");
  await expect(page).toHaveURL(/\/quan-tri$/);
  await noHorizontalScroll(page);
  await page.goto("/quan-tri/hoc-sinh");
  await page.getByText("+ Thêm học sinh mới").click();
  const fullName = `Tuyển sinh E2E ${suffix}`;
  await page.getByLabel("Họ tên học sinh").fill(fullName);
  await page.getByLabel("SĐT phụ huynh").fill("0912345678");
  await page.getByRole("button", { name: "Lưu học sinh" }).click();
  await page.waitForURL(/\/quan-tri\/hoc-sinh\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(fullName);
  const studentUrl = page.url();
  const code = (await page.getByRole("heading", { level: 1 }).locator(".muted").textContent())!.trim();

  await page.getByRole("button", { name: "Tạo tài khoản đăng nhập" }).click();
  const message = await page.locator("main").getByRole("status").first().textContent();
  const temporary = message!.match(/Mật khẩu tạm: (\S+)/)![1];
  await page.getByRole("button", { name: "Đã ghi lại" }).click();
  await expect(page.getByText("Chưa đổi mật khẩu tạm")).toBeVisible();

  await page.goto(`/quan-tri/lop/${ids.classGroup}`);
  await page.getByText("+ Ghi danh học sinh").click();
  await page.getByLabel("Học sinh").selectOption({ label: `${fullName} (${code})` });
  await page.getByLabel("Số đợt đóng").fill("2");
  await page.getByRole("button", { name: "Ghi danh" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã ghi danh");

  await page.goto(studentUrl);
  await page.getByText("Ghi nhận thanh toán").click();
  await page.getByLabel("Số tiền (VND)").fill("300000");
  await page.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(page.locator("main").getByRole("status").last()).toContainText("phiếu thu số");

  await logout(page);
  await login(page, code.toLowerCase(), temporary);
  await expect(page).toHaveURL(/\/doi-mat-khau$/);
  await page.getByLabel("Mật khẩu hiện tại").fill(temporary);
  await page.getByLabel("Mật khẩu mới *", { exact: true }).fill("mat-khau-moi-123");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("mat-khau-moi-123");
  await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
  await expect(page).toHaveURL(/\/hoc-sinh$/);
  await page.goto("/hoc-sinh/hoc-phi");
  await expect(page.getByText("Đã trả một phần")).toBeVisible();
  await noHorizontalScroll(page);

  await db(async (client) => {
    const student = await client.query(`SELECT id, "userId" FROM "Student" WHERE code = $1`, [code]);
    const { id, userId } = student.rows[0];
    const enrollments = await client.query(`SELECT id FROM "Enrollment" WHERE "studentId" = $1`, [id]);
    const enrollmentIds = enrollments.rows.map((row) => row.id);
    await client.query(`DELETE FROM "Payment" WHERE "enrollmentId" = ANY($1::uuid[])`, [enrollmentIds]);
    await client.query(`DELETE FROM "FeeInstallment" WHERE "enrollmentId" = ANY($1::uuid[])`, [enrollmentIds]);
    await client.query(`DELETE FROM "Enrollment" WHERE id = ANY($1::uuid[])`, [enrollmentIds]);
    await client.query(`DELETE FROM "Student" WHERE id = $1`, [id]);
    await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
  });
});

test("student asks for leave, teacher is notified and writes a progress note", async ({ page }) => {
  await login(page, names.student);
  await page.goto("/hoc-sinh/lich");
  await page.getByText("Xin nghỉ buổi này").click();
  await page.getByLabel("Lý do *").fill("Bé đi khám răng");
  await page.getByRole("button", { name: "Gửi đơn xin nghỉ" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã gửi đơn");
  await expect(page.getByText("Đã xin nghỉ", { exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  await logout(page);

  await login(page, names.teacher);
  await expect(page.locator(".count-badge")).toBeVisible();
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Đơn xin nghỉ" }) })).toContainText("Bé đi khám răng");
  await page.getByRole("link", { name: /^Thông báo/ }).click();
  await page.getByRole("button", { name: new RegExp(`${names.studentName} xin nghỉ`) }).click();
  await expect(page).toHaveURL(new RegExp(`/giao-vien/buoi/${ids.futureLesson}$`));
  await page.getByRole("button", { name: "Đã biết" }).click();
  await expect(page.getByText("Đã xem", { exact: true })).toBeVisible();

  await page.goto(`/giao-vien/lop/${ids.classGroup}`);
  await page.getByRole("link", { name: "Xem & nhận xét" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(names.studentName);
  await page.getByLabel("Nhận xét *").fill("Tháng này tiến bộ nhiều, cần luyện thêm khai cuộc.");
  await page.getByRole("button", { name: "Lưu nhận xét" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Đã lưu nhận xét");
  await expect(page.locator(".note-list")).toContainText("Tháng này tiến bộ nhiều");
  await noHorizontalScroll(page);
  await logout(page);

  await login(page, names.student);
  await expect(page.locator(".note-list")).toContainText("Tháng này tiến bộ nhiều");
});

test("staff tracks fees by due colour and class progress", async ({ page }) => {
  await login(page, "giaovu", "demo12345");
  await expect(page.getByRole("heading", { name: "Học phí cần thu" })).toBeVisible();
  await page.goto("/quan-tri/hoc-phi?loc=tat-ca");
  await expect(page.getByRole("heading", { name: "Công nợ học phí" })).toBeVisible();
  await expect(page.locator(".stat.tone-bad")).toContainText("Quá hạn");
  await noHorizontalScroll(page);

  await page.goto("/quan-tri/lop?trang_thai=tat-ca");
  const row = page.getByRole("row").filter({ hasText: `E2E-${suffix}`.toUpperCase() });
  await expect(row.getByRole("progressbar")).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto(`/quan-tri/lop/${ids.classGroup}`);
  await expect(page.getByRole("heading", { name: "Tổng quan & trạng thái" })).toBeVisible();
  await page.getByText("Kết thúc lớp", { exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận: kết thúc lớp" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(/còn \d+ buổi/i);

  await page.goto("/quan-tri/thu-tien");
  await expect(page.getByRole("heading", { name: "Sổ thu tiền" })).toBeVisible();
  await noHorizontalScroll(page);
});
