"use server";

import { redirect } from "next/navigation";
import { requireActionActor, runAction } from "@/lib/action";
import { getDb } from "@/lib/db";
import { markNotificationsRead } from "@/lib/services/notifications";

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    const actor = await requireActionActor();
    await markNotificationsRead(getDb(), actor);
    return "Đã đánh dấu tất cả là đã đọc.";
  });
}

/** Marks a notification read, then opens its (same-site) link. */
export async function openNotificationAction(formData: FormData) {
  const actor = await requireActionActor();
  const href = await markNotificationsRead(getDb(), actor, String(formData.get("id") ?? ""));
  redirect(href || "/thong-bao");
}
