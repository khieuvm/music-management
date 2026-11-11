import { csvResponse } from "@/lib/csv";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dueCsv, dueReport, parseDueView } from "@/lib/services/fees";
import { localDateKey } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.mustChangePassword || (actor.role !== "ADMIN" && actor.role !== "STAFF")) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const view = parseDueView(url.searchParams.get("loc") ?? "");
  const { rows } = await dueReport(getDb(), { view, classId: url.searchParams.get("lop") ?? "", q: url.searchParams.get("q") ?? "" });
  return csvResponse(dueCsv(rows), `cong-no-${view}-${localDateKey(new Date())}.csv`);
}
