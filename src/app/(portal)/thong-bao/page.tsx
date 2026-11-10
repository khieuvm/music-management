import { markAllNotificationsReadAction, openNotificationAction } from "@/app/actions/notifications";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/fields";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/lib/services/notifications";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Thông báo" };

export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await listNotifications(getDb(), actor);
  const unread = items.filter((item) => !item.readAt).length;
  return (
    <>
      <div className="page-head"><h1>Thông báo</h1></div>
      <section className="panel">
        {unread > 0 && <ActionForm action={markAllNotificationsReadAction} submitLabel={`Đánh dấu đã đọc (${unread})`} />}
        {!items.length ? <Empty>Chưa có thông báo nào.</Empty> : (
          <ul className="notification-list">
            {items.map((item) => (
              <li key={item.id} className={item.readAt ? "" : "unread"}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="link-button">
                    <strong>{item.title}</strong>
                    {item.body && <span className="muted">{item.body}</span>}
                    <small className="muted">{formatDateTime(item.createdAt)}{item.readAt ? "" : " · Mới"}</small>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
