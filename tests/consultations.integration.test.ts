import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveConsultation } from "../src/lib/consultations";
import { consultationSchema } from "../src/lib/consultation-validation";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.searchParams.set("options", `-c search_path=${schema}`);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl.toString() }, { schema }) });
const admin = new Client({ connectionString: process.env.DATABASE_URL });
const marker = `integration-${randomUUID()}`;
let sequence = 0;
let schemaCreated = false;

function input() {
  sequence += 1;
  return consultationSchema.parse({
    contactName: marker,
    phone: `09${String(Date.now() % 100000000 + sequence).padStart(8, "0").slice(-8)}`,
    consent: true,
  });
}

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await admin.query(`SET search_path TO "${schema}"`);
  const root = new URL("../prisma/migrations/", import.meta.url);
  const migrations = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const migration of migrations) {
    await admin.query(await readFile(new URL(`${migration}/migration.sql`, root), "utf8"));
  }
});

afterAll(async () => {
  try {
    await db.$disconnect();
    if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    await admin.end();
  }
});

describe("consultation persistence on PostgreSQL", () => {
  it("persists one lead and consent, without returning private data", async () => {
    const data = input();
    await expect(saveConsultation(db, data, `${marker}-save`)).resolves.toBeUndefined();
    const lead = await db.consultationRequest.findFirstOrThrow({ where: { contactName: marker, phone: data.phone } });
    expect(lead.status).toBe("NEW");
    expect(lead.privacyVersion).toBe("local-preview-v1");
    expect(lead.consentedAt).toBeInstanceOf(Date);
  });
  it("does not accept an unpublished course", async () => {
    const draft = await db.course.create({
      data: { slug: marker, title: "Draft", summary: "Draft", description: "Draft", audience: "Test", subject: "Test" },
    });
    const data = { ...input(), courseId: draft.id };
    await expect(saveConsultation(db, data, `${marker}-draft`)).rejects.toMatchObject({ status: 422 });
    expect(await db.consultationRequest.count({ where: { phone: data.phone, contactName: marker } })).toBe(0);
  });
  it("atomically limits concurrent requests for the same phone", async () => {
    const data = input();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => saveConsultation(db, data, `${marker}-concurrency`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await db.consultationRequest.count({ where: { phone: data.phone, contactName: marker } })).toBe(3);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429 });
    }
  });
  it("limits the same caller across different phone numbers", async () => {
    const caller = `${marker}-source-limit`;
    for (let count = 0; count < 5; count += 1) {
      await saveConsultation(db, input(), caller);
    }
    await expect(saveConsultation(db, input(), caller)).rejects.toMatchObject({ status: 429 });
  });
  it("allows another submission after the rate window expires", async () => {
    const data = input();
    const caller = `${marker}-expiry`;
    await saveConsultation(db, data, caller);
    await db.rateLimitBucket.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    for (let count = 0; count < 3; count += 1) {
      await saveConsultation(db, data, caller);
    }
    await expect(saveConsultation(db, data, caller)).rejects.toMatchObject({ status: 429 });
  });
  it("rejects negative public fees at database level", async () => {
    const course = await db.course.create({
      data: { slug: `${marker}-fee`, title: "Test", summary: "Test", description: "Test", audience: "Test", subject: "Test" },
    });
    await expect(db.courseOffering.create({
      data: { courseId: course.id, deliveryMode: "OFFLINE", format: "GROUP", referenceFeeVnd: -1 },
    })).rejects.toThrow();
  });
});
