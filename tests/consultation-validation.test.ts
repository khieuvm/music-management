import { describe, expect, it } from "vitest";
import { consultationSchema } from "../src/lib/consultation-validation";
import { readJsonBody, RequestError } from "../src/lib/http";

const valid = { contactName: "Khách thử nghiệm", phone: "0901234567", consent: true };

describe("consultation validation", () => {
  it("normalizes Vietnamese mobile numbers and whitespace", () => {
    const parsed = consultationSchema.parse({ ...valid, phone: "+84 901 234 567", contactName: "  Khách thử  " });
    expect(parsed.phone).toBe("0901234567");
    expect(parsed.contactName).toBe("Khách thử");
  });
  it.each([
    { consent: false }, { phone: "123" }, { contactName: "" },
    { note: "x".repeat(1001) }, { website: "bot" }, { courseId: "not-an-id" },
    { status: "ENROLLED" },
  ])("rejects invalid input %j", (change) => {
    expect(consultationSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it("allows undecided course without creating an account", () => {
    expect(consultationSchema.parse({ ...valid, courseId: "" }).courseId).toBe("");
  });
});

describe("bounded JSON reader", () => {
  it("reads JSON bodies", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid) });
    expect(await readJsonBody(request)).toEqual(valid);
  });
  it("rejects oversized payloads without relying on Content-Length", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x".repeat(100) }) });
    await expect(readJsonBody(request, 20)).rejects.toMatchObject({ status: 413 });
  });
  it("reports invalid JSON and unsupported content types", async () => {
    const invalid = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    await expect(readJsonBody(invalid)).rejects.toMatchObject({ status: 400 });
    const unsupported = new Request("http://localhost", { method: "POST", body: "{}" });
    await expect(readJsonBody(unsupported)).rejects.toBeInstanceOf(RequestError);
  });
});
