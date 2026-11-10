import { Field, Select, TextArea } from "@/components/fields";
import { studentStatusLabels, teacherStatusLabels } from "@/lib/labels";
import { dateOnlyKey } from "@/lib/time";

type StudentValues = {
  fullName: string; dateOfBirth: Date | null; parentName: string; parentPhone: string; parentEmail: string; status: string; note: string;
};

export function StudentFields({ student }: { student?: StudentValues }) {
  return (
    <div className="form-grid">
      <Field label="Họ tên học sinh" name="fullName" required maxLength={100} defaultValue={student?.fullName} />
      <Field label="Ngày sinh" name="dateOfBirth" type="date" defaultValue={student?.dateOfBirth ? dateOnlyKey(student.dateOfBirth) : ""} />
      <Field label="Tên phụ huynh" name="parentName" maxLength={100} defaultValue={student?.parentName} />
      <Field label="SĐT phụ huynh" name="parentPhone" type="tel" maxLength={20} defaultValue={student?.parentPhone} />
      <Field label="Email phụ huynh" name="parentEmail" type="email" maxLength={254} defaultValue={student?.parentEmail} />
      <Select label="Trạng thái" name="status" defaultValue={student?.status ?? "ACTIVE"}>
        {Object.entries(studentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <div className="span-2"><TextArea label="Ghi chú" name="note" maxLength={1000} defaultValue={student?.note} /></div>
    </div>
  );
}

type TeacherValues = { fullName: string; phone: string; email: string; subjects: string; status: string; note: string };

export function TeacherFields({ teacher }: { teacher?: TeacherValues }) {
  return (
    <div className="form-grid">
      <Field label="Họ tên giáo viên" name="fullName" required maxLength={100} defaultValue={teacher?.fullName} />
      <Field label="Môn dạy" name="subjects" maxLength={200} placeholder="Piano, Cờ vua…" defaultValue={teacher?.subjects} />
      <Field label="Số điện thoại" name="phone" type="tel" maxLength={20} defaultValue={teacher?.phone} />
      <Field label="Email" name="email" type="email" maxLength={254} defaultValue={teacher?.email} />
      <Select label="Trạng thái" name="status" defaultValue={teacher?.status ?? "ACTIVE"}>
        {Object.entries(teacherStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <div className="span-2"><TextArea label="Ghi chú" name="note" maxLength={1000} defaultValue={teacher?.note} /></div>
    </div>
  );
}
