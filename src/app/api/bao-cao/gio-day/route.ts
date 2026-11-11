import { csvResponse } from "@/lib/csv";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { teachingReport, teachingCsv } from "@/lib/services/reports";
import { isDateString } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.mustChangePassword || (actor.role !== "ADMIN" && actor.role !== "STAFF")) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("tu") ?? "";
  const to = url.searchParams.get("den") ?? "";
  if (!isDateString(from) || !isDateString(to) || from > to) return new Response("Khoảng ngày không hợp lệ.", { status: 400 });
  const csv = teachingCsv(await teachingReport(getDb(), from, to));
  return csvResponse(csv, `gio-day-${from}-${to}.csv`);
}
