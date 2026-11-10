import { Field, TextArea } from "@/components/fields";

export function AssignmentFields() {
  return (
    <>
      <Field label="Tiêu đề" name="title" required maxLength={200} placeholder="Ví dụ: Tập gam Đô trưởng 2 quãng tám" />
      <TextArea label="Hướng dẫn" name="instructions" maxLength={5000} rows={4} />
      <Field label="Hạn nộp" name="dueAt" type="datetime-local" />
      <label className="choice"><input type="checkbox" name="requireVideo" defaultChecked /> Bắt buộc nộp video</label>
    </>
  );
}
