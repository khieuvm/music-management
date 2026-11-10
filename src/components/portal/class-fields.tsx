import { Field, Select } from "@/components/fields";
import { classFormatLabels, deliveryLabels } from "@/lib/format";
import { classStatusLabels } from "@/lib/labels";
import { dateOnlyKey } from "@/lib/time";

type Option = { id: string; label: string };
type ClassValues = {
  code: string; name: string; courseId: string; teacherId: string; deliveryMode: string; format: string; capacity: number;
  tuitionVnd: number; location: string; meetingUrl: string; startDate: Date; endDate: Date | null; status: string;
};

export function ClassFields({ value, courses, teachers }: { value?: ClassValues; courses: Option[]; teachers: Option[] }) {
  return (
    <div className="form-grid">
      <Field label="Mã lớp" name="code" required maxLength={30} pattern="[A-Za-z0-9\-]{2,30}" defaultValue={value?.code} placeholder="PIANO-CB-01" />
      <Field label="Tên lớp" name="name" required maxLength={150} defaultValue={value?.name} />
      <Select label="Khóa học" name="courseId" required defaultValue={value?.courseId ?? ""}>
        <option value="" disabled>Chọn khóa học</option>
        {courses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </Select>
      <Select label="Giáo viên chính" name="teacherId" required defaultValue={value?.teacherId ?? ""}>
        <option value="" disabled>Chọn giáo viên</option>
        {teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </Select>
      <Select label="Hình thức" name="deliveryMode" defaultValue={value?.deliveryMode ?? "OFFLINE"}>
        {Object.entries(deliveryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Select label="Loại lớp" name="format" defaultValue={value?.format ?? "GROUP"}>
        {Object.entries(classFormatLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Field label="Sĩ số tối đa" name="capacity" type="number" min={1} max={200} required defaultValue={value?.capacity ?? 6} hint="Lớp kèm 1–1 phải là 1." />
      <Field label="Học phí cả khóa (VND)" name="tuitionVnd" inputMode="numeric" pattern="[0-9]*" required defaultValue={value?.tuitionVnd ?? ""} />
      <Field label="Phòng / địa điểm" name="location" maxLength={200} defaultValue={value?.location} />
      <Field label="Link học online (https)" name="meetingUrl" type="url" maxLength={500} defaultValue={value?.meetingUrl} />
      <Field label="Ngày bắt đầu" name="startDate" type="date" required defaultValue={value ? dateOnlyKey(value.startDate) : ""} />
      <Field label="Ngày kết thúc" name="endDate" type="date" defaultValue={value?.endDate ? dateOnlyKey(value.endDate) : ""} />
      <Select label="Trạng thái" name="status" defaultValue={value?.status ?? "PLANNED"}>
        {Object.entries(classStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
    </div>
  );
}

export async function classOptions(db: import("@/generated/prisma/client").PrismaClient, includeTeacherId?: string) {
  const [courses, teachers] = await Promise.all([
    db.course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.teacher.findMany({
      where: { OR: [{ status: "ACTIVE" }, ...(includeTeacherId ? [{ id: includeTeacherId }] : [])] },
      orderBy: { fullName: "asc" }, select: { id: true, fullName: true, subjects: true },
    }),
  ]);
  return {
    courses: courses.map((item) => ({ id: item.id, label: item.title })),
    teachers: teachers.map((item) => ({ id: item.id, label: item.subjects ? `${item.fullName} (${item.subjects})` : item.fullName })),
  };
}
