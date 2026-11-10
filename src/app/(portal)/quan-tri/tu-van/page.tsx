import { updateConsultationAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Select } from "@/components/fields";
import { getDb } from "@/lib/db";
import { consultationStatusLabels } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Yêu cầu tư vấn" };

export default async function ConsultationsPage({ searchParams }: PageProps<"/quan-tri/tu-van">) {
  const status = firstParam((await searchParams).trang_thai);
  const filter = status in consultationStatusLabels ? (status as keyof typeof consultationStatusLabels) : undefined;
  const requests = await getDb().consultationRequest.findMany({
    where: filter ? { status: filter } : { status: { in: ["NEW", "CONTACTING"] } },
    include: { course: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <div className="page-head">
        <h1>Yêu cầu tư vấn</h1>
        <nav className="filter-tabs" aria-label="Lọc trạng thái">
          <a href="/quan-tri/tu-van" aria-current={!filter ? "page" : undefined}>Cần xử lý</a>
          {Object.entries(consultationStatusLabels).map(([value, label]) => (
            <a key={value} href={`/quan-tri/tu-van?trang_thai=${value}`} aria-current={filter === value ? "page" : undefined}>{label}</a>
          ))}
        </nav>
      </div>
      {!requests.length && <Empty>Không có yêu cầu nào.</Empty>}
      <div className="card-list">
        {requests.map((request) => (
          <article className="panel" key={request.id}>
            <div className="row-between">
              <h2>{request.contactName} · <a href={`tel:${request.phone}`}>{request.phone}</a></h2>
              <Badge tone={request.status === "NEW" ? "warn" : "default"}>{consultationStatusLabels[request.status]}</Badge>
            </div>
            <p className="muted">{formatDateTime(request.createdAt)} · {request.course?.title ?? "Chưa chọn khóa"}</p>
            {request.note && <p>{request.note}</p>}
            <ActionForm action={updateConsultationAction} submitLabel="Lưu" className="inline-form">
              <input type="hidden" name="id" value={request.id} />
              <Select label="Trạng thái" name="status" id={`status-${request.id}`} defaultValue={request.status}>
                {Object.entries(consultationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Field label="Ghi chú nội bộ" name="staffNote" id={`note-${request.id}`} defaultValue={request.staffNote} maxLength={1000} />
            </ActionForm>
          </article>
        ))}
      </div>
    </>
  );
}
