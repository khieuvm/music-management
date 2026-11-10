"use server";

import { formObject, requireActionActor, runAction } from "@/lib/action";
import { getDb } from "@/lib/db";
import { createAssignment, reviewSubmission, submitAssignment } from "@/lib/services/assignments";
import { acknowledgeAbsence, cancelAbsence, requestAbsence } from "@/lib/services/absences";
import { saveAttendance } from "@/lib/services/attendance";
import { addStudentNote, deleteStudentNote } from "@/lib/services/student-notes";

export async function saveAttendanceAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    const { lessonId = "", topic = "", teacherNote = "", overrideReason = "" } = formObject(formData);
    const entries = formData.getAll("studentId").map((value) => {
      const studentId = String(value);
      return {
        studentId,
        status: String(formData.get(`status_${studentId}`) ?? ""),
        comment: String(formData.get(`comment_${studentId}`) ?? ""),
      };
    });
    await saveAttendance(getDb(), actor, lessonId, {
      topic, teacherNote, overrideReason, entries,
    });
    return "Đã lưu điểm danh và xác nhận buổi dạy.";
  });
}

export async function createAssignmentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    const { classId = "", ...data } = formObject(formData);
    await createAssignment(getDb(), actor, classId, data);
    return "Đã giao bài tập.";
  });
}

export async function reviewSubmissionAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    const { submissionId = "", ...data } = formObject(formData);
    await reviewSubmission(getDb(), actor, submissionId, data);
    return "Đã lưu nhận xét.";
  });
}

export async function submitAssignmentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["STUDENT"]);
    const { assignmentId = "", ...data } = formObject(formData);
    await submitAssignment(getDb(), actor, assignmentId, data);
    return "Đã nộp bài. Giáo viên sẽ xem và nhận xét.";
  });
}

export async function requestAbsenceAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["STUDENT"]);
    const { lessonId = "", ...data } = formObject(formData);
    await requestAbsence(getDb(), actor, lessonId, data);
    return "Đã gửi đơn xin nghỉ. Giáo viên đã được thông báo.";
  });
}

export async function cancelAbsenceAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["STUDENT"]);
    await cancelAbsence(getDb(), actor, String(formData.get("requestId") ?? ""));
    return "Đã rút đơn xin nghỉ.";
  });
}

export async function acknowledgeAbsenceAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    await acknowledgeAbsence(getDb(), actor, String(formData.get("requestId") ?? ""));
    return "Đã xác nhận.";
  });
}

export async function addStudentNoteAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    const { classId = "", studentId = "", ...data } = formObject(formData);
    const note = await addStudentNote(getDb(), actor, classId, studentId, data);
    return note.shared ? "Đã lưu nhận xét; học sinh/phụ huynh sẽ thấy." : "Đã lưu ghi chú nội bộ.";
  });
}

export async function deleteStudentNoteAction(formData: FormData) {
  return runAction(async () => {
    const actor = await requireActionActor(["ADMIN", "STAFF", "TEACHER"]);
    await deleteStudentNote(getDb(), actor, String(formData.get("noteId") ?? ""));
    return "Đã xóa nhận xét.";
  });
}
