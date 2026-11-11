import { csvResponse } from "@/lib/csv";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { paymentLedger, paymentLedgerCsv } from "@/lib/services/fees";
import { isDateString } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.mustChangePassword || (actor.role !== "ADMIN" && actor.role !== "STAFF")) {
    return new Response("Forbidden", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const from = params.get("tu") ?? "";
  const to = params.get("den") ?? "";
  if (!isDateString(from) || !isDateString(to) || from > to) return new Response("Khoảng ngày không hợp lệ.", { status: 400 });
  const ledger = await paymentLedger(getDb(), { from, to, method: params.get("hinh_thuc") ?? "" });
  return csvResponse(paymentLedgerCsv(ledger), `so-thu-${from}-${to}.csv`);
}
