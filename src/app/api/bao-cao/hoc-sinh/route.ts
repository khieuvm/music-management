import { csvResponse } from "@/lib/csv";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { studentDirectory, studentDirectoryCsv } from "@/lib/services/people";
import { localDateKey } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.mustChangePassword || (actor.role !== "ADMIN" && actor.role !== "STAFF")) {
    return new Response("Forbidden", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const rows = await studentDirectory(getDb(), {
    q: params.get("q") ?? "", status: params.get("trang_thai") ?? "", classId: params.get("lop") ?? "", fee: params.get("hoc_phi") ?? "",
  });
  return csvResponse(studentDirectoryCsv(rows), `danh-ba-hoc-sinh-${localDateKey(new Date())}.csv`);
}
