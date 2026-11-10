import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { consultationSchema, type ConsultationResponse } from "@/lib/consultation-validation";
import { saveConsultation } from "@/lib/consultations";
import { getDb } from "@/lib/db";
import { appUrl, readJsonBody, RequestError } from "@/lib/http";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";

function respond(body: ConsultationResponse, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(status === 429 ? { "Retry-After": "900" } : {}),
    },
  });
}

export async function POST(request: Request) {
  try {
    const allowedOrigin = new URL(appUrl()).origin;
    if (request.headers.get("origin") !== allowedOrigin) {
      throw new RequestError(403, "Yêu cầu không được gửi từ website hợp lệ.");
    }
    const parsed = consultationSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return respond({
        ok: false,
        message: "Vui lòng kiểm tra các thông tin trong biểu mẫu.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      }, 422);
    }

    let caller = "local-unproxied";
    if (process.env.TRUST_PROXY === "true") {
      const ip = request.headers.get("x-real-ip");
      if (!ip || !isIP(ip)) throw new Error("Trusted proxy must set a valid X-Real-IP.");
      caller = ip;
    } else if (process.env.NODE_ENV === "production" && !isDemoMode()) {
      // A public demo has no trusted proxy; all visitors share one (small) rate-limit bucket instead.
      throw new Error("Production consultation form requires a trusted reverse proxy.");
    }
    await saveConsultation(getDb(), parsed.data, caller);
    return respond({
      ok: true,
      message: "Đã nhận yêu cầu tư vấn. Thông tin đã được lưu; yêu cầu này chưa tạo tài khoản hoặc ghi danh.",
    }, 201);
  } catch (error) {
    if (error instanceof RequestError) {
      return respond({ ok: false, message: error.message }, error.status);
    }
    console.error("Consultation submission failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return respond({
      ok: false,
      message: "Chưa thể lưu yêu cầu. Vui lòng thử lại sau; chúng tôi chưa xác nhận gửi thành công.",
    }, 503);
  }
}
