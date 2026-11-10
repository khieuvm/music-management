import { Empty } from "@/components/fields";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Nhật ký thao tác" };

export default async function AuditPage() {
  await requireActor(["ADMIN"]);
  const logs = await getDb().auditLog.findMany({
    orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { displayName: true, username: true } } },
  });
  return (
    <>
      <div className="page-head"><h1>Nhật ký thao tác</h1></div>
      <p className="muted">300 thao tác gần nhất: tạo/sửa dữ liệu, thu/hủy học phí, điểm danh, tài khoản.</p>
      {!logs.length ? <Empty>Chưa có thao tác nào.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.actor ? `${log.actor.displayName} (${log.actor.username})` : "Hệ thống"}</td>
                  <td><code>{log.action}</code></td>
                  <td>{log.entityType}</td>
                  <td><code className="log-detail">{log.detail ? JSON.stringify(log.detail) : ""}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
