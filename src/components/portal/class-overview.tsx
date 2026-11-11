import { changeClassStatusAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Field } from "@/components/fields";
import { classFlags, classTransitionLabels, classTransitions, percent, type ClassProgress, type ClassStatusValue } from "@/lib/class-status";
import { formatVnd } from "@/lib/format";
import { classStatusLabels, classStatusTone } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/time";

type Props = {
  classGroup: { id: string; status: ClassStatusValue; capacity: number; startDate: Date; endDate: Date | null };
  students: number;
  progress: ClassProgress;
  fees: { tuitionVnd: number; paidVnd: number; outstandingVnd: number; overdueVnd: number; dueSoonVnd: number };
};

export function ProgressMeter({ progress }: { progress: ClassProgress }) {
  const value = percent(progress.completedLessons, progress.totalLessons);
  return (
    <>
      {progress.completedLessons}/{progress.totalLessons} buổi · {value}%
      <span className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ lớp"><span style={{ width: `${value}%` }} /></span>
    </>
  );
}

export function FlagList({ flags }: { flags: ReturnType<typeof classFlags> }) {
  if (!flags.length) return null;
  return <span className="flag-list">{flags.map((flag) => <Badge key={flag.key} tone={flag.tone}>{flag.label}</Badge>)}</span>;
}

export function ClassOverview({ classGroup, students, progress, fees }: Props) {
  const flags = classFlags({ status: classGroup.status, capacity: classGroup.capacity, students, progress, overdueVnd: fees.overdueVnd });
  const attendance = percent(progress.presentMarks, progress.attendanceMarks);
  return (
    <section className="panel" aria-labelledby="overview-title">
      <div className="row-between">
        <h2 id="overview-title">Tổng quan & trạng thái</h2>
        <Badge tone={classStatusTone[classGroup.status]}>{classStatusLabels[classGroup.status]}</Badge>
      </div>
      <FlagList flags={flags} />
      <div className="stat-grid compact">
        <div className="stat"><strong>{percent(progress.completedLessons, progress.totalLessons)}%</strong><span><ProgressMeter progress={progress} /></span></div>
        <div className="stat"><strong>{progress.nextLessonAt ? formatDateTime(progress.nextLessonAt) : "—"}</strong><span>Buổi kế tiếp · còn {progress.upcomingLessons} buổi</span></div>
        <div className={`stat${progress.pendingAttendance ? " tone-bad" : ""}`}><strong>{progress.pendingAttendance}</strong><span>Buổi đã qua chưa điểm danh</span></div>
        <div className="stat"><strong>{progress.attendanceMarks ? `${attendance}%` : "—"}</strong><span>Chuyên cần (có mặt + đi muộn)</span></div>
        <div className="stat tone-good"><strong>{formatVnd(fees.paidVnd)}</strong><span>Đã thu / {formatVnd(fees.tuitionVnd)}</span></div>
        <div className={`stat${fees.overdueVnd ? " tone-bad" : fees.dueSoonVnd ? " tone-warn" : ""}`}>
          <strong>{formatVnd(fees.outstandingVnd)}</strong>
          <span>Còn phải thu{fees.overdueVnd ? ` · quá hạn ${formatVnd(fees.overdueVnd)}` : ""}</span>
        </div>
      </div>
      <p className="muted">
        Khai giảng {formatDate(classGroup.startDate, true)}{classGroup.endDate ? ` · dự kiến kết thúc ${formatDate(classGroup.endDate, true)}` : ""}
        {progress.lastLessonEndsAt ? ` · buổi cuối theo lịch ${formatDate(progress.lastLessonEndsAt)}` : ""}.
        {classGroup.status === "PLANNED" && " Lớp tự chuyển sang “Đang học” khi buổi đầu tiên bắt đầu."}
      </p>
      <div className="button-row">
        {classTransitions[classGroup.status].map((next) => {
          const label = classTransitionLabels[`${classGroup.status}>${next}`];
          const danger = next === "CANCELLED";
          return (
            <details key={next} className="status-change">
              <summary className={`button small${danger ? " danger" : " secondary"}`}>{label}</summary>
              <ActionForm action={changeClassStatusAction} submitLabel={`Xác nhận: ${label.toLowerCase()}`} danger={danger}
                confirmMessage={danger ? "Hủy lớp sẽ hủy tất cả buổi sắp tới. Tiếp tục?" : undefined}>
                <input type="hidden" name="classId" value={classGroup.id} />
                <input type="hidden" name="status" value={next} />
                <p className="muted">{transitionHelp[next]}</p>
                <Field label={danger ? "Lý do hủy" : "Ghi chú (không bắt buộc)"} name="reason" id={`reason-${next}`} required={danger} maxLength={300} />
              </ActionForm>
            </details>
          );
        })}
      </div>
    </section>
  );
}

const transitionHelp: Record<ClassStatusValue, string> = {
  ACTIVE: "Lớp chuyển sang Đang học. Nếu mở lại lớp đã kết thúc, học sinh “Hoàn thành” được đưa về “Đang học”.",
  FINISHED: "Chỉ kết thúc được khi mọi buổi đã qua đều đã điểm danh và không còn buổi sắp tới. Học sinh đang học sẽ được đánh dấu Hoàn thành; học sinh và giáo viên nhận thông báo.",
  CANCELLED: "Các buổi sắp tới sẽ bị hủy; học sinh và giáo viên nhận thông báo. Học phí đã thu cần được điều chỉnh riêng nếu hoàn tiền.",
  PLANNED: "Lớp trở lại Sắp mở; các buổi đã hủy không tự khôi phục — hãy tạo lại lịch.",
};
