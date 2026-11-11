import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelLessonAction, enrollStudentAction, generateLessonsAction, saveClassAction, updateLessonAction } from "@/app/actions/manage";
import { createAssignmentAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Select } from "@/components/fields";
import { AssignmentFields } from "@/components/portal/assignment-fields";
import { ClassFields, classOptions } from "@/components/portal/class-fields";
import { ClassOverview } from "@/components/portal/class-overview";
import { emptyProgress, percent } from "@/lib/class-status";
import { installmentStateText, installmentStateTone } from "@/lib/fees";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { enrollmentStatusLabels, lessonStatusLabels, lessonTone } from "@/lib/labels";
import { isUuid } from "@/lib/page";
import { classProgress, studentAttendanceInClass, syncClassStatuses } from "@/lib/services/class-progress";
import { feeLedger } from "@/lib/services/fees";
import { dateOnlyKey, formatDate, formatDateTime, formatTime, localDateKey, localTimeKey, weekdayLabels } from "@/lib/time";

export default async function ClassDetailPage({ params }: PageProps<"/quan-tri/lop/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  await syncClassStatuses(db);
  const classGroup = await db.classGroup.findUnique({
    where: { id },
    include: {
      course: { select: { title: true } },
      teacher: { select: { fullName: true } },
      enrollments: { include: { student: { select: { id: true, code: true, fullName: true, parentName: true, parentPhone: true, userId: true } } }, orderBy: [{ status: "asc" }, { enrolledAt: "asc" }] },
      lessons: { include: { teacher: { select: { fullName: true } } }, orderBy: { startsAt: "asc" } },
      assignments: { orderBy: { createdAt: "desc" }, include: { _count: { select: { submissions: true } } } },
    },
  });
  if (!classGroup) notFound();
  const [options, candidates, progressMap, ledger, attendanceByStudent] = await Promise.all([
    classOptions(db, classGroup.teacherId),
    db.student.findMany({
      where: { status: "ACTIVE", enrollments: { none: { classId: id, status: { in: ["ACTIVE", "COMPLETED"] } } } },
      orderBy: { fullName: "asc" }, select: { id: true, code: true, fullName: true }, take: 500,
    }),
    classProgress(db, [id]),
    feeLedger(db, { classId: id, includeInactive: true }),
    studentAttendanceInClass(db, id),
  ]);
  const progress = progressMap.get(id) ?? emptyProgress;
  const feeByEnrollment = new Map(ledger.map((row) => [row.enrollment.id, row]));
  const fees = {
    tuitionVnd: ledger.reduce((sum, row) => sum + row.enrollment.tuitionVnd, 0),
    paidVnd: ledger.reduce((sum, row) => sum + row.paidVnd, 0),
    outstandingVnd: ledger.reduce((sum, row) => sum + row.outstandingVnd, 0),
    overdueVnd: ledger.reduce((sum, row) => sum + row.overdueVnd, 0),
    dueSoonVnd: ledger.reduce((sum, row) => sum + row.dueTodayVnd + row.dueSoonVnd, 0),
  };
  const now = new Date();
  const active = classGroup.enrollments.filter((item) => item.status === "ACTIVE").length;
  const open = classGroup.status === "PLANNED" || classGroup.status === "ACTIVE";
  const today = localDateKey(new Date());
  const startKey = dateOnlyKey(classGroup.startDate);
  return (
    <>
      <div className="page-head">
        <p><Link href="/quan-tri/lop">← Lớp học</Link></p>
        <h1>{classGroup.name} <span className="muted">{classGroup.code}</span></h1>
        <p className="muted">{classGroup.course.title} · GV {classGroup.teacher.fullName} · {active}/{classGroup.capacity} học sinh · {formatVnd(classGroup.tuitionVnd)}</p>
      </div>

      <ClassOverview classGroup={classGroup} students={active} progress={progress} fees={fees} />

      <details className="panel">
        <summary><strong>Sửa thông tin lớp</strong></summary>
        <p className="muted">Đổi giáo viên chính sẽ chuyển các buổi chưa dạy sang giáo viên mới.</p>
        <ActionForm action={saveClassAction} submitLabel="Lưu lớp">
          <input type="hidden" name="id" value={classGroup.id} />
          <ClassFields value={classGroup} {...options} />
        </ActionForm>
      </details>

      <section className="panel">
        <h2>Học sinh ({active}/{classGroup.capacity})</h2>
        {!classGroup.enrollments.length ? <Empty>Chưa có học sinh.</Empty> : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead><tr><th>Học sinh</th><th>Phụ huynh</th><th>Chuyên cần</th><th>Học phí</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {classGroup.enrollments.map((item) => {
                  const fee = feeByEnrollment.get(item.id);
                  const urgent = fee?.nextDue;
                  const stats = attendanceByStudent.get(item.student.id);
                  return (
                    <tr key={item.id} className={urgent && urgent.state !== "UPCOMING" ? `fee-row ${urgent.state.toLowerCase()}` : undefined}>
                      <td data-label="Học sinh"><Link href={`/quan-tri/hoc-sinh/${item.student.id}`}>{item.student.fullName}</Link><br /><span className="muted">{item.student.code} · ghi danh {formatDate(item.enrolledAt)}{item.student.userId ? "" : " · chưa có tài khoản"}</span></td>
                      <td data-label="Phụ huynh">{item.student.parentName || <span className="muted">—</span>}{item.student.parentPhone && <><br /><a className="tel" href={`tel:${item.student.parentPhone}`}>{item.student.parentPhone}</a></>}</td>
                      <td data-label="Chuyên cần">{stats?.marks ? <>{percent(stats.present, stats.marks)}% <span className="muted">({stats.present}/{stats.marks}{stats.absent ? `, vắng ${stats.absent}` : ""})</span></> : <span className="muted">—</span>}</td>
                      <td data-label="Học phí">
                        {!fee ? <span className="muted">Miễn phí</span>
                          : !urgent ? <Badge tone="good">Đã đóng đủ</Badge>
                            : <><Badge tone={installmentStateTone[urgent.state]}>{installmentStateText(urgent)}</Badge><br /><span className="muted">còn {formatVnd(fee.outstandingVnd)}</span></>}
                      </td>
                      <td data-label="Trạng thái"><Badge tone={item.status === "ACTIVE" ? "good" : "default"}>{enrollmentStatusLabels[item.status]}</Badge></td>
                      <td data-label="Khác"><Link href={`/quan-tri/lop/${classGroup.id}/hoc-sinh/${item.student.id}`}>Tiến độ & nhận xét</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {open && active < classGroup.capacity && (
          <details>
            <summary>+ Ghi danh học sinh</summary>
            {!candidates.length ? <p className="muted">Không còn học sinh đang học nào chưa ở lớp này. Thêm học sinh mới ở mục Học sinh.</p> : (
              <ActionForm action={enrollStudentAction} submitLabel="Ghi danh" resetOnSuccess>
                <input type="hidden" name="classId" value={classGroup.id} />
                <div className="form-grid">
                  <Select label="Học sinh" name="studentId" required defaultValue="">
                    <option value="" disabled>Chọn học sinh</option>
                    {candidates.map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.code})</option>)}
                  </Select>
                  <Field label="Học phí (VND)" name="tuitionVnd" inputMode="numeric" pattern="[0-9]*" placeholder={String(classGroup.tuitionVnd)} hint="Để trống = học phí của lớp." />
                  <Field label="Số đợt đóng" name="installmentCount" type="number" min={1} max={12} required defaultValue={1} />
                  <Field label="Hạn đợt đầu" name="firstDueDate" type="date" required defaultValue={today > startKey ? today : startKey} />
                  <div className="span-2"><Field label="Ghi chú" name="note" maxLength={500} /></div>
                </div>
              </ActionForm>
            )}
          </details>
        )}
      </section>

      <section className="panel">
        <h2>Lịch học ({classGroup.lessons.filter((item) => item.status !== "CANCELLED").length} buổi)</h2>
        {open && (
          <details>
            <summary>+ Tạo lịch hằng tuần</summary>
            <ActionForm action={generateLessonsAction} submitLabel="Tạo các buổi học">
              <input type="hidden" name="classId" value={classGroup.id} />
              <fieldset>
                <legend>Các ngày trong tuần</legend>
                <div className="choice-row">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <label key={day} className="choice"><input type="checkbox" name="weekdays" value={day} />{weekdayLabels[day]}</label>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                <Field label="Từ ngày" name="fromDate" type="date" required defaultValue={today > startKey ? today : startKey} />
                <Field label="Đến ngày" name="toDate" type="date" required defaultValue={classGroup.endDate ? dateOnlyKey(classGroup.endDate) : ""} />
                <Field label="Giờ bắt đầu" name="startTime" type="time" required defaultValue="17:30" />
                <Field label="Thời lượng (phút)" name="durationMinutes" type="number" min={15} max={600} required defaultValue={90} />
              </div>
              <p className="muted">Hệ thống chặn nếu giáo viên bị trùng lịch với lớp khác.</p>
            </ActionForm>
          </details>
        )}
        {!classGroup.lessons.length ? <Empty>Chưa có buổi học.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Buổi</th><th>Thời gian</th><th>Giáo viên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {classGroup.lessons.map((lesson, index) => (
                  <tr key={lesson.id} className={lesson.status === "SCHEDULED" && lesson.endsAt < now ? "warn-row" : undefined}>
                    <td>{index + 1}</td>
                    <td><Link href={`/quan-tri/buoi/${lesson.id}`}>{formatDateTime(lesson.startsAt)}–{formatTime(lesson.endsAt)}</Link>{lesson.topic && <><br /><span className="muted">{lesson.topic}</span></>}</td>
                    <td>{lesson.teacher.fullName}{lesson.teacherId !== classGroup.teacherId && <> <Badge tone="warn">Dạy thay</Badge></>}</td>
                    <td>{lesson.status === "SCHEDULED"
                      ? lesson.endsAt < now ? <Badge tone="bad">Đã qua, chưa điểm danh</Badge> : lesson.startsAt > now ? <Badge>Sắp tới</Badge> : <Badge tone="warn">Đang diễn ra</Badge>
                      : <Badge tone={lessonTone[lesson.status]}>{lessonStatusLabels[lesson.status]}</Badge>}{lesson.cancelReason && <><br /><span className="muted">{lesson.cancelReason}</span></>}</td>
                    <td>
                      {lesson.status === "SCHEDULED" && (
                        <details>
                          <summary>Đổi / hủy</summary>
                          <ActionForm action={updateLessonAction} submitLabel="Lưu buổi học">
                            <input type="hidden" name="lessonId" value={lesson.id} />
                            <Field label="Ngày" name="date" id={`date-${lesson.id}`} type="date" required defaultValue={localDateKey(lesson.startsAt)} />
                            <Field label="Giờ bắt đầu" name="startTime" id={`time-${lesson.id}`} type="time" required defaultValue={localTimeKey(lesson.startsAt)} />
                            <Field label="Thời lượng (phút)" name="durationMinutes" id={`dur-${lesson.id}`} type="number" min={15} max={600} required defaultValue={Math.round((lesson.endsAt.getTime() - lesson.startsAt.getTime()) / 60000)} />
                            <Select label="Giáo viên (dạy thay)" name="teacherId" id={`teacher-${lesson.id}`} defaultValue={lesson.teacherId}>
                              {options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                            </Select>
                          </ActionForm>
                          <ActionForm action={cancelLessonAction} submitLabel="Hủy buổi này" danger confirmMessage="Hủy buổi học này?">
                            <input type="hidden" name="lessonId" value={lesson.id} />
                            <Field label="Lý do hủy" name="reason" id={`cancel-${lesson.id}`} required maxLength={300} />
                          </ActionForm>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Bài tập</h2>
        {!classGroup.assignments.length ? <Empty>Chưa giao bài tập.</Empty> : (
          <ul className="plain-list">
            {classGroup.assignments.map((item) => (
              <li key={item.id}>
                <Link href={`/quan-tri/bai-tap/${item.id}`}>{item.title}</Link> <span className="muted">· {item._count.submissions} lượt nộp{item.dueAt ? ` · hạn ${formatDateTime(item.dueAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
        {open && (
          <details>
            <summary>+ Giao bài tập</summary>
            <ActionForm action={createAssignmentAction} submitLabel="Giao bài" resetOnSuccess>
              <input type="hidden" name="classId" value={classGroup.id} />
              <AssignmentFields />
            </ActionForm>
          </details>
        )}
      </section>
    </>
  );
}
