"use server";

import { redirect } from "next/navigation";
import { formObject, requireActionActor, runAction } from "@/lib/action";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { classStatusLabels } from "@/lib/labels";
import { saveCourse } from "@/lib/services/catalog";
import { cancelLesson, changeClassStatus, enrollStudent, generateLessons, saveClass, updateLesson, withdrawEnrollment } from "@/lib/services/classes";
import { updateConsultation } from "@/lib/services/consultations-admin";
import { recordPayment, replanInstallments, sendFeeReminder, voidPayment } from "@/lib/services/fees";
import { createPayRate, deletePayRate } from "@/lib/services/pay-rates";
import { createStudent, createTeacher, updateStudent, updateTeacher } from "@/lib/services/people";
import {
  createStaffAccount, createStudentAccount, createTeacherAccount, resetPassword, setUserActive,
} from "@/lib/services/users";

const managers = ["ADMIN", "STAFF"] as const;

function accountMessage(result: { username: string; temporaryPassword: string }) {
  return `Tên đăng nhập: ${result.username} · Mật khẩu tạm: ${result.temporaryPassword} — Hãy ghi lại và giao trực tiếp; mật khẩu chỉ hiện một lần và phải đổi ở lần đăng nhập đầu.`;
}

export async function createStudentAction(formData: FormData) {
  let id = "";
  const result = await runAction(async () => {
    const actor = await requireActionActor([...managers]);
    id = (await createStudent(getDb(), actor, formObject(formData))).id;
  });
  if (result?.ok) redirect(`/quan-tri/hoc-sinh/${id}`);
  return result;
}

export async function updateStudentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id = "", ...data } = formObject(formData);
    await updateStudent(getDb(), actor, id, data);
  });
}

export async function createStudentAccountAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id = "", username = "" } = formObject(formData);
    return accountMessage(await createStudentAccount(getDb(), actor, id, username));
  });
}

export async function createTeacherAction(formData: FormData) {
  let id = "";
  const result = await runAction(async () => {
    const actor = await requireActionActor([...managers]);
    id = (await createTeacher(getDb(), actor, formObject(formData))).id;
  });
  if (result?.ok) redirect(`/quan-tri/giao-vien/${id}`);
  return result;
}

export async function updateTeacherAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id = "", ...data } = formObject(formData);
    await updateTeacher(getDb(), actor, id, data);
  });
}

export async function createTeacherAccountAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id = "", username = "" } = formObject(formData);
    return accountMessage(await createTeacherAccount(getDb(), actor, id, username));
  });
}

export async function createStaffAccountAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN"]);
    const { username = "", displayName = "", role = "" } = formObject(formData);
    if (role !== "ADMIN" && role !== "STAFF") throw new RangeError("Chọn vai trò.");
    if (displayName.trim().length < 2) throw new RangeError("Vui lòng nhập tên hiển thị.");
    return accountMessage(await createStaffAccount(getDb(), actor, { username, displayName: displayName.trim().slice(0, 100), role }));
  });
}

export async function resetPasswordAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    return accountMessage(await resetPassword(getDb(), actor, formObject(formData).userId ?? ""));
  });
}

export async function setUserActiveAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { userId = "", active = "" } = formObject(formData);
    await setUserActive(getDb(), actor, userId, active === "true");
    return active === "true" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản và đăng xuất mọi phiên.";
  });
}

export async function saveCourseAction(formData: FormData) {
  let id = "";
  let created = false;
  const result = await runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id: courseId = "", ...data } = formObject(formData);
    created = !courseId;
    id = (await saveCourse(getDb(), actor, courseId || null, data)).id;
  });
  if (result?.ok && created) redirect(`/quan-tri/khoa-hoc/${id}`);
  return result;
}

export async function saveClassAction(formData: FormData) {
  let id = "";
  let created = false;
  const result = await runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id: classId = "", ...data } = formObject(formData);
    created = !classId;
    id = (await saveClass(getDb(), actor, classId || null, data)).id;
  });
  if (result?.ok && created) redirect(`/quan-tri/lop/${id}`);
  return result;
}

export async function enrollStudentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { classId = "", ...data } = formObject(formData);
    const { restored } = await enrollStudent(getDb(), actor, classId, data);
    return restored ? "Đã khôi phục học sinh vào lớp (giữ học phí và lịch sử thanh toán cũ)." : "Đã ghi danh và tạo lịch đóng học phí.";
  });
}

export async function withdrawEnrollmentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { enrollmentId = "", reason = "" } = formObject(formData);
    await withdrawEnrollment(getDb(), actor, enrollmentId, reason);
    return "Đã chuyển học sinh sang trạng thái rút khỏi lớp. Lịch sử điểm danh và học phí vẫn được giữ.";
  });
}

export async function generateLessonsAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { classId = "", ...data } = formObject(formData);
    const count = await generateLessons(getDb(), actor, classId, { ...data, weekdays: formData.getAll("weekdays").map(String) });
    return `Đã tạo ${count} buổi học.`;
  });
}

export async function updateLessonAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { lessonId = "", ...data } = formObject(formData);
    await updateLesson(getDb(), actor, lessonId, data);
  });
}

export async function changeClassStatusAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { classId = "", ...data } = formObject(formData);
    const { classGroup, detail } = await changeClassStatus(getDb(), actor, classId, data);
    return `Lớp chuyển sang “${classStatusLabels[classGroup.status]}”. ${detail}`.trim();
  });
}

export async function cancelLessonAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { lessonId = "", reason = "" } = formObject(formData);
    await cancelLesson(getDb(), actor, lessonId, reason);
    return "Đã hủy buổi học.";
  });
}

export async function recordPaymentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { enrollmentId = "", ...data } = formObject(formData);
    const { payment, duplicate } = await recordPayment(getDb(), actor, enrollmentId, data);
    return duplicate
      ? `Khoản này đã được ghi nhận trước đó (phiếu thu số ${payment.receiptNo}); không ghi thêm.`
      : `Đã ghi nhận ${formatVnd(payment.amountVnd)} — phiếu thu số ${payment.receiptNo}.`;
  });
}

export async function voidPaymentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN"]);
    const { paymentId = "", reason = "" } = formObject(formData);
    await voidPayment(getDb(), actor, paymentId, reason);
    return "Đã hủy phiếu thu; số còn phải thu được cập nhật.";
  });
}

export async function sendFeeReminderAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { enrollmentId = "" } = formObject(formData);
    const { amountVnd } = await sendFeeReminder(getDb(), actor, enrollmentId);
    return `Đã gửi nhắc ${formatVnd(amountVnd)} vào tài khoản học sinh/phụ huynh.`;
  });
}

export async function replanInstallmentsAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { enrollmentId = "", ...data } = formObject(formData);
    await replanInstallments(getDb(), actor, enrollmentId, data);
    return "Đã cập nhật học phí và lịch đóng.";
  });
}

export async function updateConsultationAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor([...managers]);
    const { id = "", ...data } = formObject(formData);
    await updateConsultation(getDb(), actor, id, data);
  });
}

export async function createPayRateAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN"]);
    await createPayRate(getDb(), actor, formObject(formData));
    return "Đã lưu đơn giá. Báo cáo giờ dạy đã tính theo đơn giá mới.";
  });
}

export async function deletePayRateAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN"]);
    await deletePayRate(getDb(), actor, formObject(formData).id ?? "");
    return "Đã xóa đơn giá.";
  });
}
