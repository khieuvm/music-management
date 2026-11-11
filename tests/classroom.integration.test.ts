import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Actor } from "../src/lib/access";
import { login } from "../src/lib/services/auth";
import { saveAttendance } from "../src/lib/services/attendance";
import { createAssignment, getAccessibleFile } from "../src/lib/services/assignments";
import { cancelLesson, changeClassStatus, enrollStudent, generateLessons, saveClass } from "../src/lib/services/classes";
import { classBoard, classProgress, syncClassStatuses } from "../src/lib/services/class-progress";
import { updateStudent } from "../src/lib/services/people";
import { acknowledgeAbsence, cancelAbsence, requestAbsence } from "../src/lib/services/absences";
import { addStudentNote, deleteStudentNote, getStudentInClass } from "../src/lib/services/student-notes";
import { markNotificationsRead, safeHref } from "../src/lib/services/notifications";
import { dueReport, feeLedger, recordPayment, sendFeeReminder, voidPayment } from "../src/lib/services/fees";
import { createStaffAccount, createTeacherAccount } from "../src/lib/services/users";
import { hashPassword } from "../src/lib/auth/password";
import { createPayRate, deletePayRate } from "../src/lib/services/pay-rates";
import { teachingReport } from "../src/lib/services/reports";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.searchParams.set("options", `-c search_path=${schema}`);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl.toString() }, { schema }) });
const admin = new Client({ connectionString: process.env.DATABASE_URL });
let schemaCreated = false;
let counter = 0;

const HOUR = 3_600_000;
const today = new Date().toISOString().slice(0, 10);

async function user(role: Actor["role"], extra: { teacherId?: string | null; studentId?: string | null } = {}): Promise<Actor> {
  counter += 1;
  const created = await db.user.create({
    data: { username: `u${counter}.${role.toLowerCase()}`, passwordHash: "x", role, displayName: `${role} ${counter}`, mustChangePassword: false },
  });
  return { userId: created.id, role, displayName: created.displayName, username: created.username, mustChangePassword: false,
    teacherId: extra.teacherId ?? null, studentId: extra.studentId ?? null };
}

async function teacherActor() {
  counter += 1;
  const teacher = await db.teacher.create({ data: { fullName: `GV ${counter}` } });
  const actor = await user("TEACHER", { teacherId: teacher.id });
  await db.teacher.update({ where: { id: teacher.id }, data: { userId: actor.userId } });
  return actor;
}

async function studentActor() {
  counter += 1;
  const student = await db.student.create({ data: { code: `HS${String(counter).padStart(4, "0")}`, fullName: `HS ${counter}` } });
  const actor = await user("STUDENT", { studentId: student.id });
  await db.student.update({ where: { id: student.id }, data: { userId: actor.userId } });
  return actor;
}

async function classFor(teacherId: string, capacity = 10) {
  counter += 1;
  const course = await db.course.create({
    data: { slug: `c-${counter}`, title: "Khóa", summary: "x", description: "x", audience: "x", subject: "Cờ vua", category: "SKILL" },
  });
  return db.classGroup.create({
    data: { code: `L-${counter}`, name: "Lớp", courseId: course.id, teacherId, deliveryMode: "OFFLINE", format: "GROUP",
      capacity, tuitionVnd: 1_000_000, startDate: new Date(`${today}T00:00:00Z`), status: "ACTIVE" },
  });
}

let manager: Actor;
let staff: Actor;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await admin.query(`SET search_path TO "${schema}"`);
  const root = new URL("../prisma/migrations/", import.meta.url);
  const migrations = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const migration of migrations) await admin.query(await readFile(new URL(`${migration}/migration.sql`, root), "utf8"));
  manager = await user("ADMIN");
  staff = await user("STAFF");
});

afterAll(async () => {
  try {
    await db.$disconnect();
    if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    await admin.end();
  }
});

describe("enrollment", () => {
  it("never exceeds class capacity under concurrent enrollments", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!, 2);
    const students = await Promise.all(Array.from({ length: 5 }, () => studentActor()));
    const results = await Promise.allSettled(students.map((student) =>
      enrollStudent(db, staff, group.id, { studentId: student.studentId, installmentCount: "2", firstDueDate: today })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await db.enrollment.count({ where: { classId: group.id, status: "ACTIVE" } })).toBe(2);
    const installments = await db.feeInstallment.findMany({ where: { enrollment: { classId: group.id } } });
    expect(installments).toHaveLength(4);
  });
});

describe("tuition payments", () => {
  it("are idempotent, cannot overpay, and only an admin can void a receipt", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await studentActor();
    const { enrollment } = await enrollStudent(db, staff, group.id, { studentId: student.studentId, installmentCount: "1", firstDueDate: today });
    const payment = { amountVnd: "600000", method: "CASH", paidDate: today, note: "", idempotencyKey: randomUUID() };

    const [first, second] = await Promise.all([
      recordPayment(db, staff, enrollment.id, payment), recordPayment(db, staff, enrollment.id, payment),
    ]);
    expect(first.payment.id).toBe(second.payment.id);
    expect(await db.payment.count({ where: { enrollmentId: enrollment.id } })).toBe(1);

    await expect(recordPayment(db, staff, enrollment.id, { ...payment, idempotencyKey: randomUUID() })).rejects.toThrow(/vượt quá/);
    await expect(voidPayment(db, staff, first.payment.id, "Nhầm")).rejects.toMatchObject({ status: 403 });
    await voidPayment(db, manager, first.payment.id, "Nhầm số tiền");
    await expect(recordPayment(db, staff, enrollment.id, { ...payment, idempotencyKey: randomUUID() })).resolves.toMatchObject({ duplicate: false });
  });
});

describe("attendance", () => {
  async function setup(endedHoursAgo: number) {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await studentActor();
    await db.enrollment.create({ data: { studentId: student.studentId!, classId: group.id, tuitionVnd: 0, enrolledAt: new Date(Date.now() - 1000 * HOUR) } });
    const endsAt = new Date(Date.now() - endedHoursAgo * HOUR);
    const lesson = await db.lesson.create({
      data: { classId: group.id, teacherId: teacher.teacherId!, startsAt: new Date(endsAt.getTime() - HOUR), endsAt },
    });
    const body = { topic: "Khai cuộc", teacherNote: "", overrideReason: "", entries: [{ studentId: student.studentId, status: "PRESENT", comment: "Tốt" }] };
    return { teacher, lesson, body };
  }

  it("lets only the assigned teacher confirm the lesson, which then counts as taught", async () => {
    const { teacher, lesson, body } = await setup(1);
    const other = await teacherActor();
    await expect(saveAttendance(db, other, lesson.id, body)).rejects.toMatchObject({ status: 403 });
    await expect(saveAttendance(db, teacher, lesson.id, { ...body, entries: [] })).rejects.toThrow(/đủ tất cả/);
    await saveAttendance(db, teacher, lesson.id, body);
    expect(await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).toMatchObject({ status: "COMPLETED", topic: "Khai cuộc" });
  });

  it("locks teacher edits after 48 hours; managers must give a reason", async () => {
    const { teacher, lesson, body } = await setup(49);
    await expect(saveAttendance(db, teacher, lesson.id, body)).rejects.toMatchObject({ status: 403 });
    await expect(saveAttendance(db, staff, lesson.id, body)).rejects.toThrow(/lý do/);
    await saveAttendance(db, staff, lesson.id, { ...body, overrideReason: "GV quên điểm danh" });
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: lesson.id, action: "attendance.recorded" } });
    expect(log.detail).toMatchObject({ overrideReason: "GV quên điểm danh" });
  });

  it("refuses lessons that have not started", async () => {
    const { teacher, lesson, body } = await setup(-5);
    await expect(saveAttendance(db, teacher, lesson.id, body)).rejects.toThrow(/đã bắt đầu/);
  });
});

describe("teacher schedule conflicts", () => {
  it("are rejected by the service and enforced by the database constraint", async () => {
    const teacher = await teacherActor();
    const a = await classFor(teacher.teacherId!);
    const b = await classFor(teacher.teacherId!);
    const pattern = { fromDate: "2030-01-01", toDate: "2030-01-31", weekdays: ["2"], startTime: "18:00", durationMinutes: "90" };
    expect(await generateLessons(db, staff, a.id, pattern)).toBe(5);
    await expect(generateLessons(db, staff, b.id, { ...pattern, startTime: "19:00" })).rejects.toMatchObject({ status: 409 });

    const existing = await db.lesson.findFirstOrThrow({ where: { classId: a.id } });
    const error = await db.lesson.create({
      data: { classId: b.id, teacherId: teacher.teacherId!, startsAt: existing.startsAt, endsAt: existing.endsAt },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    const text = `${(error as Error).message} ${String((error as { cause?: unknown }).cause ?? "")} ${JSON.stringify((error as { meta?: unknown }).meta ?? {})}`;
    expect(text).toContain("Lesson_teacher_no_overlap");
  });
});

describe("submission videos", () => {
  it("are visible to the uploader, managers and the class teacher only", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const owner = await studentActor();
    const classmate = await studentActor();
    const otherTeacher = await teacherActor();
    const assignment = await db.assignment.create({ data: { classId: group.id, title: "Bài", createdById: teacher.userId } });
    const file = await db.storedFile.create({
      data: { ownerId: owner.userId, storageKey: randomUUID(), originalName: "a.mp4", mimeType: "video/mp4", sizeBytes: 10n },
    });
    await db.submission.create({ data: { assignmentId: assignment.id, studentId: owner.studentId!, attempt: 1, videoFileId: file.id } });

    for (const actor of [owner, teacher, staff]) expect(await getAccessibleFile(db, actor, file.id)).not.toBeNull();
    for (const actor of [classmate, otherTeacher]) expect(await getAccessibleFile(db, actor, file.id)).toBeNull();
  });
});

describe("accounts", () => {
  it("staff can create teacher accounts but never admin or staff accounts", async () => {
    const teacher = await db.teacher.create({ data: { fullName: "GV mới" } });
    await expect(createTeacherAccount(db, staff, teacher.id, "gv.moi")).resolves.toMatchObject({ username: "gv.moi" });
    await expect(createStaffAccount(db, staff, { username: "sep.moi", displayName: "Sếp", role: "ADMIN" })).rejects.toMatchObject({ status: 403 });
    await expect(createStaffAccount(db, staff, { username: "gv.vu2", displayName: "GV", role: "STAFF" })).rejects.toMatchObject({ status: 403 });
    await expect(createStaffAccount(db, manager, { username: "giaovu.moi", displayName: "Giáo vụ", role: "STAFF" })).resolves.toBeTruthy();
  });

  it("login limits failed attempts but successful sign-ins do not use up the shared budget", async () => {
    const created = await db.user.create({
      data: { username: "dang.nhap", passwordHash: await hashPassword("dung-mat-khau"), role: "STAFF", displayName: "x" },
    });
    for (let index = 0; index < 31; index += 1) await login(db, "dang.nhap", "dung-mat-khau", "shared-ip");
    for (let index = 0; index < 10; index += 1) {
      await expect(login(db, "dang.nhap", "sai-mat-khau", "shared-ip")).rejects.toMatchObject({ status: 401 });
    }
    await expect(login(db, "dang.nhap", "dung-mat-khau", "shared-ip")).rejects.toMatchObject({ status: 429 });
    expect(await db.session.count({ where: { userId: created.id } })).toBe(31);
  }, 60_000);
});

async function enrolled(classId: string) {
  const student = await studentActor();
  await enrollStudent(db, staff, classId, { studentId: student.studentId, installmentCount: "1", firstDueDate: today });
  return student;
}

function lessonAt(classId: string, teacherId: string, startOffsetHours: number) {
  const startsAt = new Date(Date.now() + startOffsetHours * HOUR);
  return db.lesson.create({ data: { classId, teacherId, startsAt, endsAt: new Date(startsAt.getTime() + HOUR) } });
}

describe("absence requests", () => {
  it("lets an enrolled student request leave before the lesson and notifies the assigned teacher", async () => {
    const teacher = await teacherActor();
    const otherTeacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await enrolled(group.id);
    const outsider = await studentActor();
    const lesson = await lessonAt(group.id, teacher.teacherId!, 24);

    await expect(requestAbsence(db, outsider, lesson.id, { reason: "Ốm" })).rejects.toMatchObject({ status: 404 });
    await expect(requestAbsence(db, teacher, lesson.id, { reason: "Ốm" })).rejects.toMatchObject({ status: 403 });
    await expect(requestAbsence(db, student, lesson.id, { reason: "" })).rejects.toThrow();
    const request = await requestAbsence(db, student, lesson.id, { reason: "Bé bị sốt" });
    await expect(requestAbsence(db, student, lesson.id, { reason: "Lần 2" })).rejects.toMatchObject({ status: 409 });
    expect(await db.notification.count({ where: { userId: teacher.userId, href: `/giao-vien/buoi/${lesson.id}` } })).toBe(1);

    await expect(acknowledgeAbsence(db, otherTeacher, request.id)).rejects.toMatchObject({ status: 403 });
    await cancelAbsence(db, student, request.id);
    await expect(requestAbsence(db, student, lesson.id, { reason: "Gia đình đi xa" })).resolves.toMatchObject({ status: "PENDING" });

    const started = await lessonAt(group.id, teacher.teacherId!, -0.5);
    await expect(requestAbsence(db, student, started.id, { reason: "Muộn" })).rejects.toMatchObject({ status: 422 });
  });

  it("is acknowledged automatically when the teacher records attendance", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await enrolled(group.id);
    const lesson = await lessonAt(group.id, teacher.teacherId!, 2);
    const request = await requestAbsence(db, student, lesson.id, { reason: "Đi khám" });
    await db.enrollment.updateMany({ where: { classId: group.id }, data: { enrolledAt: new Date(Date.now() - 24 * HOUR) } });
    await db.lesson.update({ where: { id: lesson.id }, data: { startsAt: new Date(Date.now() - 2 * HOUR), endsAt: new Date(Date.now() - HOUR) } });
    await saveAttendance(db, teacher, lesson.id, { entries: [{ studentId: student.studentId!, status: "EXCUSED", comment: "" }] });
    expect(await db.absenceRequest.findUnique({ where: { id: request.id } })).toMatchObject({ status: "ACKNOWLEDGED", acknowledgedById: teacher.userId });
    await expect(cancelAbsence(db, student, request.id)).rejects.toMatchObject({ status: 422 });
  });
});

describe("student notes", () => {
  it("are limited to the class teacher, notify only when shared, and only authors delete their own", async () => {
    const teacher = await teacherActor();
    const otherTeacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await enrolled(group.id);
    const outsider = await studentActor();

    await expect(addStudentNote(db, otherTeacher, group.id, student.studentId!, { content: "Tốt" })).rejects.toMatchObject({ status: 403 });
    await expect(addStudentNote(db, teacher, group.id, outsider.studentId!, { content: "Tốt" })).rejects.toMatchObject({ status: 404 });
    await expect(getStudentInClass(db, otherTeacher, group.id, student.studentId!)).rejects.toMatchObject({ status: 403 });

    await addStudentNote(db, teacher, group.id, student.studentId!, { content: "Cần luyện ngón 4", shared: "" });
    expect(await db.notification.count({ where: { userId: student.userId } })).toBe(0);
    const shared = await addStudentNote(db, teacher, group.id, student.studentId!, { content: "Tiến bộ rõ", shared: "on" });
    expect(shared.shared).toBe(true);
    expect(await db.notification.count({ where: { userId: student.userId } })).toBe(1);

    const staffNote = await addStudentNote(db, staff, group.id, student.studentId!, { content: "Phụ huynh hỏi lịch thi", shared: "" });
    await expect(deleteStudentNote(db, teacher, staffNote.id)).rejects.toMatchObject({ status: 403 });
    await deleteStudentNote(db, teacher, shared.id);
    const data = await getStudentInClass(db, teacher, group.id, student.studentId!);
    expect(data.notes.map((note) => note.content).sort()).toEqual(["Cần luyện ngón 4", "Phụ huynh hỏi lịch thi"]);
  });
});

describe("notifications", () => {
  it("reach enrolled students on new homework and cancelled lessons, and are private to their owner", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await enrolled(group.id);
    const outsider = await studentActor();
    await createAssignment(db, teacher, group.id, { title: "Luyện gam Đô", instructions: "", dueAt: "", requireVideo: "on" });
    const lesson = await lessonAt(group.id, teacher.teacherId!, 48);
    await cancelLesson(db, staff, lesson.id, "Giáo viên ốm");

    const mine = await db.notification.findMany({ where: { userId: student.userId }, orderBy: { createdAt: "asc" } });
    expect(mine.map((item) => item.title)).toEqual([expect.stringContaining("Luyện gam Đô"), expect.stringContaining("Nghỉ buổi")]);
    expect(await db.notification.count({ where: { userId: outsider.userId } })).toBe(0);
    expect(await db.notification.count({ where: { userId: teacher.userId, title: { contains: "Nghỉ buổi" } } })).toBe(1);

    expect(await markNotificationsRead(db, outsider, mine[0].id)).toBe("");
    expect(await db.notification.count({ where: { userId: student.userId, readAt: null } })).toBe(2);
    expect(await markNotificationsRead(db, student, mine[0].id)).toMatch(/^\/hoc-sinh\/bai-tap\//);
    await markNotificationsRead(db, student);
    expect(await db.notification.count({ where: { userId: student.userId, readAt: null } })).toBe(0);
    expect(await markNotificationsRead(db, student, "not-a-uuid")).toBe("");
  });

  it("never stores off-site links", () => {
    expect(safeHref("/hoc-sinh")).toBe("/hoc-sinh");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)", undefined]) expect(safeHref(bad)).toBe("");
  });
});

describe("room conflicts", () => {
  it("blocks overlapping offline lessons in the same room but ignores online classes", async () => {
    const first = await teacherActor();
    const second = await teacherActor();
    const roomA = await classFor(first.teacherId!);
    await db.classGroup.update({ where: { id: roomA.id }, data: { location: "Phòng 1" } });
    const roomB = await classFor(second.teacherId!);
    await db.classGroup.update({ where: { id: roomB.id }, data: { location: " phòng 1 " } });
    const online = await classFor(second.teacherId!);
    await db.classGroup.update({ where: { id: online.id }, data: { location: "Phòng 1", deliveryMode: "ONLINE" } });

    const date = new Date(Date.now() + 10 * 24 * HOUR).toISOString().slice(0, 10);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const slot = { fromDate: date, toDate: date, weekdays: [weekday], startTime: "09:00", durationMinutes: "60" };
    await generateLessons(db, staff, roomA.id, slot);
    await expect(generateLessons(db, staff, roomB.id, slot)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Phòng") });
    await expect(generateLessons(db, staff, online.id, { ...slot, startTime: "11:00" })).resolves.toBe(1);
    await expect(generateLessons(db, staff, roomB.id, { ...slot, startTime: "10:00" })).resolves.toBe(1);
  });
});

describe("pay rates", () => {
  it("only the manager edits rates and the teaching report prices lessons with them", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    // Tuesday 2025-03-04 17:00–19:00 local: 2h, 1h evening, no weekend.
    await db.lesson.create({
      data: { classId: group.id, teacherId: teacher.teacherId!, status: "COMPLETED",
        startsAt: new Date("2025-03-04T17:00:00+07:00"), endsAt: new Date("2025-03-04T19:00:00+07:00") },
    });
    const report = () => teachingReport(db, "2025-03-01", "2025-03-31", teacher.teacherId!);
    expect((await report())[0].summary).toMatchObject({ payVnd: 0, unpricedLessons: 1 });

    const rate = { effectiveFrom: "2025-01-01", hourlyVnd: "100000", eveningExtraVnd: "20000", eveningStart: "18:00", perLessonVnd: "5000" };
    await expect(createPayRate(db, staff, rate)).rejects.toMatchObject({ status: 403 });
    await createPayRate(db, manager, rate);
    await expect(createPayRate(db, manager, rate)).rejects.toMatchObject({ status: 409 });
    expect((await report())[0].summary).toMatchObject({ payVnd: 225_000, unpricedLessons: 0 });

    const own = await createPayRate(db, manager, { ...rate, teacherId: teacher.teacherId!, hourlyVnd: "150000", eveningStart: "17:00" });
    expect((await report())[0].summary).toMatchObject({ eveningMinutes: 120, payVnd: 300_000 + 40_000 + 5_000 });
    await expect(createPayRate(db, manager, { ...rate, teacherId: randomUUID() })).rejects.toMatchObject({ status: 422 });
    await expect(createPayRate(db, manager, { ...rate, effectiveFrom: "2025-02-01", hourlyVnd: "-1" })).rejects.toThrow();

    await deletePayRate(db, manager, own.id);
    expect((await report())[0].summary.payVnd).toBe(225_000);
    expect(await db.auditLog.count({ where: { entityType: "PayRate" } })).toBeGreaterThanOrEqual(3);
  });
});

function dayKey(offset: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(Date.now() + offset * 86_400_000));
}

describe("fee due states", () => {
  it("colour installments by due date, filter the collection list and rate-limit reminders", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await studentActor();
    const enrollment = await db.enrollment.create({ data: { studentId: student.studentId!, classId: group.id, tuitionVnd: 400 } });
    await db.feeInstallment.createMany({
      data: [-5, 0, 3, 20].map((offset, index) => ({
        enrollmentId: enrollment.id, sequence: index + 1, amountVnd: 100, dueDate: new Date(`${dayKey(offset)}T00:00:00Z`),
      })),
    });
    const [row] = await feeLedger(db, { classId: group.id });
    expect(row.installments.map((item) => item.state)).toEqual(["OVERDUE", "DUE_TODAY", "DUE_SOON", "UPCOMING"]);
    expect([row.worst, row.overdueVnd, row.dueTodayVnd, row.dueSoonVnd, row.outstandingVnd]).toEqual(["OVERDUE", 100, 100, 100, 400]);

    const collect = await dueReport(db, { view: "can-thu", classId: group.id });
    expect(collect.rows.map(({ item }) => item.state)).toEqual(["OVERDUE", "DUE_TODAY", "DUE_SOON"]);
    expect(collect.summary.OVERDUE).toEqual({ amountVnd: 100, count: 1, students: 1 });
    expect((await dueReport(db, { view: "qua-han", classId: group.id, q: "không-có-ai" })).rows).toHaveLength(0);

    await recordPayment(db, staff, enrollment.id, { amountVnd: "100", method: "CASH", paidDate: dayKey(0), idempotencyKey: randomUUID() });
    expect((await feeLedger(db, { classId: group.id }))[0].worst).toBe("DUE_TODAY");

    const reminded = await sendFeeReminder(db, staff, enrollment.id);
    expect(reminded.amountVnd).toBe(200);
    const note = await db.notification.findFirstOrThrow({ where: { userId: student.userId } });
    expect(note.href).toBe("/hoc-sinh/hoc-phi");
    await expect(sendFeeReminder(db, staff, enrollment.id)).rejects.toMatchObject({ status: 409 });
    await expect(sendFeeReminder(db, student, enrollment.id)).rejects.toMatchObject({ status: 403 });

    const noAccount = await db.student.create({ data: { code: `HSX${counter}`, fullName: "Không tài khoản" } });
    const other = await db.enrollment.create({ data: { studentId: noAccount.id, classId: group.id, tuitionVnd: 100 } });
    await db.feeInstallment.create({ data: { enrollmentId: other.id, sequence: 1, amountVnd: 100, dueDate: new Date(`${dayKey(-1)}T00:00:00Z`) } });
    await expect(sendFeeReminder(db, staff, other.id)).rejects.toMatchObject({ status: 422 });
  });
});

describe("class lifecycle", () => {
  it("auto-starts planned classes, blocks finishing with unconfirmed lessons and requires a reason to cancel", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    await db.classGroup.update({ where: { id: group.id }, data: { status: "PLANNED" } });
    const student = await studentActor();
    await enrollStudent(db, staff, group.id, { studentId: student.studentId, installmentCount: "1", firstDueDate: today });
    const now = Date.now();
    await db.enrollment.updateMany({ where: { classId: group.id }, data: { enrolledAt: new Date(now - 72 * HOUR) } });
    const past = await db.lesson.create({ data: { classId: group.id, teacherId: teacher.teacherId!, startsAt: new Date(now - 30 * HOUR), endsAt: new Date(now - 29 * HOUR) } });
    const future = await db.lesson.create({ data: { classId: group.id, teacherId: teacher.teacherId!, startsAt: new Date(now + 48 * HOUR), endsAt: new Date(now + 49 * HOUR) } });

    expect(await syncClassStatuses(db)).toBeGreaterThanOrEqual(1);
    expect((await db.classGroup.findUniqueOrThrow({ where: { id: group.id } })).status).toBe("ACTIVE");
    expect(await db.auditLog.count({ where: { action: "class.auto_started", entityId: group.id } })).toBe(1);
    await syncClassStatuses(db);
    expect(await db.auditLog.count({ where: { action: "class.auto_started", entityId: group.id } })).toBe(1);

    const progress = (await classProgress(db, [group.id])).get(group.id)!;
    expect([progress.totalLessons, progress.completedLessons, progress.pendingAttendance, progress.upcomingLessons]).toEqual([2, 0, 1, 1]);
    const [board] = await classBoard(db, { id: group.id });
    expect(board.flags.map((flag) => flag.key)).toContain("attendance");

    await expect(changeClassStatus(db, staff, group.id, { status: "PLANNED" })).rejects.toMatchObject({ status: 422 });
    await expect(changeClassStatus(db, staff, group.id, { status: "FINISHED" })).rejects.toThrow(/chưa điểm danh/);
    await saveAttendance(db, teacher, past.id, { topic: "Bài 1", entries: [{ studentId: student.studentId!, status: "PRESENT" }] });
    await expect(changeClassStatus(db, staff, group.id, { status: "FINISHED" })).rejects.toThrow(/chưa học/);
    await cancelLesson(db, staff, future.id, "Kết thúc sớm");
    const [done] = await classBoard(db, { id: group.id });
    expect(done.flags.map((flag) => flag.key)).toContain("finish");

    await changeClassStatus(db, staff, group.id, { status: "FINISHED" });
    expect((await db.enrollment.findFirstOrThrow({ where: { classId: group.id } })).status).toBe("COMPLETED");
    expect(await db.notification.count({ where: { userId: student.userId, title: { contains: "đã kết thúc" } } })).toBe(1);
    await changeClassStatus(db, staff, group.id, { status: "ACTIVE" });
    expect((await db.enrollment.findFirstOrThrow({ where: { classId: group.id } })).status).toBe("ACTIVE");

    const extra = await db.lesson.create({ data: { classId: group.id, teacherId: teacher.teacherId!, startsAt: new Date(now + 72 * HOUR), endsAt: new Date(now + 73 * HOUR) } });
    await expect(changeClassStatus(db, staff, group.id, { status: "CANCELLED" })).rejects.toThrow(/lý do/);
    await changeClassStatus(db, staff, group.id, { status: "CANCELLED", reason: "Không đủ học sinh" });
    expect((await db.lesson.findUniqueOrThrow({ where: { id: extra.id } })).status).toBe("CANCELLED");
  });

  it("editing class details never changes its status", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    await saveClass(db, staff, group.id, {
      code: group.code, name: "Tên mới", courseId: group.courseId, teacherId: group.teacherId, deliveryMode: "OFFLINE", format: "GROUP",
      capacity: "10", tuitionVnd: "1000000", location: "", meetingUrl: "", startDate: today, endDate: "", status: "CANCELLED",
    });
    const updated = await db.classGroup.findUniqueOrThrow({ where: { id: group.id } });
    expect([updated.name, updated.status]).toEqual(["Tên mới", "ACTIVE"]);
  });
});

describe("student status", () => {
  it("cannot be set to stopped while the student is still in a class", async () => {
    const teacher = await teacherActor();
    const group = await classFor(teacher.teacherId!);
    const student = await studentActor();
    await enrollStudent(db, staff, group.id, { studentId: student.studentId, installmentCount: "1", firstDueDate: today });
    const input = { fullName: "Học sinh A", parentName: "", parentPhone: "", parentEmail: "", note: "" };
    await expect(updateStudent(db, staff, student.studentId!, { ...input, status: "STOPPED" })).rejects.toMatchObject({ status: 422 });
    await updateStudent(db, staff, student.studentId!, { ...input, status: "PAUSED" });
  });
});
