import { expect, test } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";

test("public catalog, detail and selected consultation course work", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Âm nhạc bắt đầu từ chính bạn." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  await page.getByRole("heading", { name: "Piano căn bản" }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Piano căn bản");
  await page.getByRole("link", { name: "Nhận tư vấn khóa này" }).click();
  await expect(page.getByLabel("Khóa học quan tâm")).toContainText("Piano căn bản");
  await expect(page.getByLabel("Khóa học quan tâm").locator("option:checked")).toHaveText("Piano căn bản");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("draft course is not public", async ({ page }) => {
  const response = await page.goto("/khoa-hoc/khoa-nhap-khong-cong-khai");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy trang này." })).toBeVisible();
});

test("invalid submission and cross-origin requests are explicitly rejected", async ({ request }) => {
  const invalid = await request.post("/api/tu-van", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { contactName: "", phone: "123", consent: false },
  });
  expect(invalid.status()).toBe(422);
  const crossOrigin = await request.post("/api/tu-van", {
    headers: { Origin: "https://example.invalid" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
  expect((await request.get("/api/tu-van")).status()).toBe(405);
});

test("valid browser submission is persisted before showing success", async ({ page }) => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for end-to-end verification.");
  const marker = `e2e-${randomUUID()}`;
  const phone = `09${String(randomBytes(4).readUInt32BE() % 100000000).padStart(8, "0")}`;
  const caller = `2001:db8:${randomBytes(2).toString("hex")}::1`;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await page.setExtraHTTPHeaders({ "X-Real-IP": caller });
    await page.goto("/tu-van?khoa=piano-can-ban");
    await page.getByLabel("Tên người liên hệ").fill(marker);
    await page.getByLabel("Số điện thoại").fill(phone);
    await page.getByRole("checkbox").check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Gửi yêu cầu tư vấn" }).click();
    await expect(page.getByRole("status")).toContainText("Đã nhận yêu cầu tư vấn.");
    const result = await db.query(
      'SELECT "status", "courseId", "privacyVersion" FROM "ConsultationRequest" WHERE "contactName" = $1 AND "phone" = $2',
      [marker, phone],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].status).toBe("NEW");
    expect(result.rows[0].courseId).toBeTruthy();
    expect(result.rows[0].privacyVersion).toBe("local-preview-v1");
    await expect(page.getByLabel("Tên người liên hệ")).toHaveValue("");
  } finally {
    try {
      await db.query('DELETE FROM "ConsultationRequest" WHERE "contactName" = $1', [marker]);
    } finally {
      await db.end();
    }
  }
});
