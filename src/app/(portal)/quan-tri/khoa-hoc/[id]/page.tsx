import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCourseAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Field, Select, TextArea } from "@/components/fields";
import { getDb } from "@/lib/db";
import { categoryLabels, classFormatLabels, deliveryLabels } from "@/lib/format";
import { publicationLabels } from "@/lib/labels";
import { isUuid } from "@/lib/page";
import { OFFERING_KEYS } from "@/lib/services/catalog";

export default async function CourseEditPage({ params }: PageProps<"/quan-tri/khoa-hoc/[id]">) {
  const { id } = await params;
  const isNew = id === "moi";
  if (!isNew && !isUuid(id)) notFound();
  const course = isNew ? null : await getDb().course.findUnique({ where: { id }, include: { offerings: true } });
  if (!isNew && !course) notFound();
  const offering = (mode: string, format: string) => course?.offerings.find((item) => item.deliveryMode === mode && item.format === format);
  return (
    <>
      <div className="page-head">
        <p><Link href="/quan-tri/khoa-hoc">← Khóa học</Link></p>
        <h1>{course ? course.title : "Khóa học mới"}</h1>
        {course?.status === "PUBLISHED" && <p><Link href={`/khoa-hoc/${course.slug}`} target="_blank">Xem trên website ↗</Link></p>}
      </div>
      <section className="panel">
        <ActionForm action={saveCourseAction} submitLabel={course ? "Lưu thay đổi" : "Tạo khóa học"}>
          <input type="hidden" name="id" value={course?.id ?? ""} />
          <div className="form-grid">
            <Field label="Tên khóa học" name="title" required maxLength={150} defaultValue={course?.title} />
            <Field label="Đường dẫn (slug)" name="slug" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={course?.slug} hint="Ví dụ: piano-co-ban, co-vua-nhap-mon" />
            <Select label="Nhóm" name="category" defaultValue={course?.category ?? "TALENT"}>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Field label="Môn học" name="subject" required maxLength={50} defaultValue={course?.subject} placeholder="Piano, Guitar, Cờ vua…" />
            <Select label="Hiển thị" name="status" defaultValue={course?.status ?? "DRAFT"}>
              {Object.entries(publicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Field label="Đối tượng phù hợp" name="audience" required maxLength={300} defaultValue={course?.audience} />
            <div className="span-2"><Field label="Mô tả ngắn" name="summary" required maxLength={300} defaultValue={course?.summary} /></div>
            <div className="span-2"><TextArea label="Nội dung chi tiết" name="description" required maxLength={5000} rows={8} defaultValue={course?.description} /></div>
          </div>
          <fieldset className="sub-panel">
            <legend>Hình thức học & học phí tham khảo (VND)</legend>
            <div className="form-grid">
              {OFFERING_KEYS.map(([mode, format]) => {
                const current = offering(mode, format);
                return (
                  <div key={`${mode}_${format}`} className="offering-row">
                    <label className="choice">
                      <input type="checkbox" name={`offer_${mode}_${format}`} defaultChecked={Boolean(current)} />
                      {deliveryLabels[mode]} · {classFormatLabels[format]}
                    </label>
                    <input aria-label={`Học phí ${deliveryLabels[mode]} ${classFormatLabels[format]}`} name={`fee_${mode}_${format}`} inputMode="numeric" pattern="[0-9]*" defaultValue={current?.referenceFeeVnd ?? ""} placeholder="Để trống = liên hệ" />
                  </div>
                );
              })}
            </div>
          </fieldset>
        </ActionForm>
      </section>
    </>
  );
}
