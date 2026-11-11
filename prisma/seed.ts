import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/auth/password.ts";

// A public demo server (DEMO_MODE=true) runs in production mode but must still get the fake data.
if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
  throw new Error("Demo seeding is forbidden in production.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const courses = [
  {
    slug: "piano-can-ban",
    title: "Piano căn bản",
    subject: "Piano",
    category: "TALENT" as const,
    summary: "Làm quen phím đàn, đọc nốt và chơi những giai điệu đầu tiên.",
    description: "Bắt đầu từ tư thế, nhịp điệu và cách đọc bản nhạc. Luyện tập từng bước để phối hợp hai tay và hoàn thành một bản nhạc ngắn.\nĐây là khóa minh họa dùng để kiểm thử, chưa mở tuyển sinh.",
    audience: "Người mới bắt đầu, học sinh và người lớn muốn xây nền tảng piano.",
    fee: 6000000,
  },
  {
    slug: "guitar-khoi-dau",
    title: "Guitar khởi đầu",
    subject: "Guitar",
    category: "TALENT" as const,
    summary: "Từ những hợp âm đầu tiên đến tự đệm bài hát yêu thích.",
    description: "Làm quen cách lên dây, bấm hợp âm, chuyển hợp âm và các tiết tấu đệm cơ bản. Có thể lựa chọn học tại trung tâm hoặc online.\nNội dung minh họa, không phải khóa tuyển sinh thật.",
    audience: "Người mới học guitar, muốn bắt đầu từ kỹ thuật và nhịp điệu cơ bản.",
    fee: 4500000,
  },
  {
    slug: "thanh-nhac-tu-tin",
    title: "Thanh nhạc tự tin",
    subject: "Thanh nhạc",
    category: "TALENT" as const,
    summary: "Khám phá giọng hát và làm quen với hơi thở, cao độ, cảm xúc.",
    description: "Tìm hiểu cách lấy hơi, khởi động giọng, giữ nhịp và xử lý một đoạn bài hát. Lựa chọn học nhóm hoặc kèm riêng.\nNội dung minh họa, không phải khóa tuyển sinh thật.",
    audience: "Người yêu ca hát và muốn rèn luyện cách sử dụng giọng an toàn.",
    fee: 5000000,
  },
  {
    slug: "co-vua-nhap-mon",
    title: "Cờ vua nhập môn",
    subject: "Cờ vua",
    category: "SKILL" as const,
    summary: "Luật chơi, khai cuộc cơ bản và rèn tư duy tính toán từng nước đi.",
    description: "Học cách di chuyển quân, các nguyên tắc khai cuộc, chiếu hết cơ bản và cách ghi biên bản ván cờ. Rèn khả năng tập trung và kiên nhẫn.\nNội dung minh họa, không phải khóa tuyển sinh thật.",
    audience: "Trẻ từ 6 tuổi và người mới làm quen cờ vua.",
    fee: 3000000,
  },
];

const OFFSET = "+07:00";
const DEMO_PASSWORD = "demo12345";

function localKey(instant: Date) {
  return new Date(instant.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function shiftDays(key: string, days: number) {
  const value = new Date(`${key}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekly(from: string, to: string, weekdays: number[], time: string, minutes: number) {
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  for (let day = from; day <= to; day = shiftDays(day, 1)) {
    if (!weekdays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) continue;
    const startsAt = new Date(`${day}T${time}:00${OFFSET}`);
    slots.push({ startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) });
  }
  return slots;
}

/** Demo accounts, classes, lessons and fees for local testing. Runs once (skips if the demo admin exists). */
async function seedDemoClassroom() {
  if (await db.user.findUnique({ where: { username: "quanly" } })) return;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = (username: string, displayName: string, role: "ADMIN" | "STAFF" | "TEACHER" | "STUDENT") =>
    db.user.create({ data: { username, displayName, role, passwordHash, mustChangePassword: false } });

  const admin = await user("quanly", "Quản lý Demo", "ADMIN");
  const staff = await user("giaovu", "Giáo vụ Demo", "STAFF");
  const lan = await db.teacher.create({
    data: { fullName: "Cô Lan (demo)", subjects: "Piano", phone: "0900000001", userId: (await user("gv.lan", "Cô Lan (demo)", "TEACHER")).id },
  });
  const minh = await db.teacher.create({
    data: { fullName: "Thầy Minh (demo)", subjects: "Cờ vua", phone: "0900000002", userId: (await user("gv.minh", "Thầy Minh (demo)", "TEACHER")).id },
  });
  const students = [];
  for (const [index, fullName, parentName] of [[1, "Nguyễn An (demo)", "Chị Hoa"], [2, "Trần Bình (demo)", "Anh Tuấn"], [3, "Lê Chi (demo)", "Chị Mai"]] as const) {
    const code = `HS${String(index).padStart(4, "0")}`;
    if (await db.student.findUnique({ where: { code } })) continue;
    const account = index < 3 ? await user(code.toLowerCase(), fullName, "STUDENT") : null;
    students.push(await db.student.create({
      data: { code, fullName, parentName, parentPhone: `09111111${index}0`, userId: account?.id },
    }));
  }
  if (students.length < 3) return;

  const today = localKey(new Date());
  const start = shiftDays(today, -21);
  const end = shiftDays(today, 60);
  const piano = await db.course.findUniqueOrThrow({ where: { slug: "piano-can-ban" } });
  const chess = await db.course.findUniqueOrThrow({ where: { slug: "co-vua-nhap-mon" } });
  const classes = [
    { code: "PIANO-DEMO-01", name: "Piano căn bản – nhóm tối T3/T5", course: piano, teacher: lan, tuition: 6_000_000,
      slots: weekly(start, end, [2, 4], "18:00", 90), members: [students[0], students[1]] },
    { code: "COVUA-DEMO-01", name: "Cờ vua nhập môn – cuối tuần", course: chess, teacher: minh, tuition: 3_000_000,
      slots: weekly(start, end, [6], "08:30", 90), members: [students[0], students[2]] },
  ];
  for (const item of classes) {
    const classGroup = await db.classGroup.create({
      data: {
        code: item.code, name: item.name, courseId: item.course.id, teacherId: item.teacher.id,
        deliveryMode: "OFFLINE", format: "GROUP", capacity: 6, tuitionVnd: item.tuition, location: "Phòng 2",
        startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`), status: "ACTIVE",
      },
    });
    for (const student of item.members) {
      const enrollment = await db.enrollment.create({
        data: { studentId: student.id, classId: classGroup.id, tuitionVnd: item.tuition, enrolledAt: new Date(`${shiftDays(start, -3)}T09:00:00${OFFSET}`) },
      });
      await db.feeInstallment.createMany({
        data: [0, 1].map((sequence) => ({
          enrollmentId: enrollment.id, sequence: sequence + 1, amountVnd: item.tuition / 2,
          dueDate: new Date(`${shiftDays(start, sequence * 30)}T00:00:00Z`),
        })),
      });
      if (student === item.members[0]) {
        await db.payment.create({
          data: { enrollmentId: enrollment.id, amountVnd: item.tuition / 2, method: "TRANSFER", paidAt: new Date(`${start}T10:00:00${OFFSET}`), receivedById: staff.id, idempotencyKey: crypto.randomUUID() },
        });
      }
    }
    const now = Date.now();
    for (const slot of item.slots) {
      // Leave the most recent past lesson unconfirmed so the attendance flow can be tried.
      const confirm = slot.endsAt.getTime() < now - 4 * 86_400_000;
      const lesson = await db.lesson.create({
        data: { classId: classGroup.id, teacherId: item.teacher.id, ...slot, status: confirm ? "COMPLETED" : "SCHEDULED", completedAt: confirm ? slot.endsAt : null, topic: confirm ? "Ôn bài cũ, học bài mới" : "" },
      });
      if (confirm) {
        await db.attendance.createMany({
          data: item.members.map((student, index) => ({
            lessonId: lesson.id, studentId: student.id, status: index === 1 && slot === item.slots[0] ? "EXCUSED" : "PRESENT",
            comment: "Tập trung, cần luyện thêm ở nhà.", updatedById: item.teacher.userId!,
          })),
        });
      }
    }
    await db.assignment.create({
      data: {
        classId: classGroup.id, createdById: item.teacher.userId!, requireVideo: true,
        title: item.course === piano ? "Quay video gam Đô trưởng hai tay" : "Quay video giải thế cờ chiếu hết 2 nước",
        instructions: "Quay ngang điện thoại, thấy rõ tay. Video dưới 3 phút.",
        dueAt: new Date(`${shiftDays(today, 5)}T21:00:00${OFFSET}`),
      },
    });
  }
  await db.payRate.create({
    data: {
      effectiveFrom: new Date(`${shiftDays(start, -30)}T00:00:00Z`), hourlyVnd: 150_000, eveningExtraVnd: 30_000,
      weekendExtraVnd: 20_000, perLessonVnd: 0, note: "Đơn giá minh họa", createdById: admin.id,
    },
  });
  const pianoClass = await db.classGroup.findUniqueOrThrow({ where: { code: "PIANO-DEMO-01" } });
  const nextLesson = await db.lesson.findFirst({
    where: { classId: pianoClass.id, status: "SCHEDULED", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" },
  });
  if (nextLesson) {
    await db.absenceRequest.create({
      data: { lessonId: nextLesson.id, studentId: students[1].id, reason: "Bé bị sốt, xin phép nghỉ buổi này.", createdById: students[1].userId! },
    });
  }
  await db.studentNote.create({
    data: {
      classId: pianoClass.id, studentId: students[0].id, authorId: lan.userId!,
      content: "Tháng này An tiến bộ rõ ở phần đọc nốt. Cần luyện thêm chuyển ngón tay trái 15 phút mỗi ngày.",
    },
  });
  await db.auditLog.create({ data: { actorId: admin.id, action: "demo.seeded", entityType: "System", entityId: "seed" } });
  console.info(`Demo accounts (password "${DEMO_PASSWORD}"): quanly, giaovu, gv.lan, gv.minh, hs0001, hs0002.`);
}

/**
 * Idempotent demo additions (also applied to an already-seeded demo database): a planned class without schedule and
 * a student whose fees are due today / within a few days, so every due-state colour is visible.
 */
async function seedDemoExtras() {
  const staff = await db.user.findUnique({ where: { username: "giaovu" } });
  const chessClass = await db.classGroup.findUnique({ where: { code: "COVUA-DEMO-01" } });
  const lan = await db.teacher.findFirst({ where: { fullName: "Cô Lan (demo)" } });
  if (!staff || !chessClass || !lan) return;
  const today = localKey(new Date());
  if (!await db.classGroup.findUnique({ where: { code: "PIANO-DEMO-02" } })) {
    const piano = await db.course.findUniqueOrThrow({ where: { slug: "piano-can-ban" } });
    await db.classGroup.create({
      data: {
        code: "PIANO-DEMO-02", name: "Piano căn bản – khóa sau (chưa xếp lịch)", courseId: piano.id, teacherId: lan.id,
        deliveryMode: "OFFLINE", format: "GROUP", capacity: 6, tuitionVnd: 6_000_000, location: "Phòng 1",
        startDate: new Date(`${shiftDays(today, 14)}T00:00:00Z`), status: "PLANNED",
      },
    });
  }
  const fullName = "Phạm Dũng (demo)";
  if (await db.student.findFirst({ where: { fullName } })) return;
  const [row] = await db.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INTEGER)) AS max FROM "Student" WHERE "code" ~ '^HS[0-9]+$'`;
  const student = await db.student.create({
    data: { code: `HS${String((row?.max ?? 0) + 1).padStart(4, "0")}`, fullName, parentName: "Anh Long", parentPhone: "0911111140" },
  });
  const enrollment = await db.enrollment.create({ data: { studentId: student.id, classId: chessClass.id, tuitionVnd: 3_000_000 } });
  await db.feeInstallment.createMany({
    data: [0, 3, 33].map((days, index) => ({
      enrollmentId: enrollment.id, sequence: index + 1, amountVnd: 1_000_000, dueDate: new Date(`${shiftDays(today, days)}T00:00:00Z`),
    })),
  });
  await db.payment.create({
    data: { enrollmentId: enrollment.id, amountVnd: 400_000, method: "CASH", paidAt: new Date(), receivedById: staff.id, idempotencyKey: crypto.randomUUID(), note: "Đóng trước một phần" },
  });
}

try {
  for (const { fee, ...data } of courses) {
    const course = await db.course.upsert({
      where: { slug: data.slug },
      create: { ...data, status: "PUBLISHED" },
      update: { category: data.category },
    });
    for (const deliveryMode of ["OFFLINE", "ONLINE"] as const) {
      for (const format of ["GROUP", "INDIVIDUAL"] as const) {
        await db.courseOffering.upsert({
          where: { courseId_deliveryMode_format: { courseId: course.id, deliveryMode, format } },
          create: {
            courseId: course.id,
            deliveryMode,
            format,
            referenceFeeVnd: format === "GROUP" ? fee : fee * 2,
          },
          update: {},
        });
      }
    }
  }
  await db.course.upsert({
    where: { slug: "khoa-nhap-khong-cong-khai" },
    create: {
      slug: "khoa-nhap-khong-cong-khai", title: "Khóa nháp",
      summary: "Không được hiển thị công khai.", description: "Dữ liệu giả để thử quyền xuất bản.",
      audience: "Nội bộ", subject: "Piano",
    },
    update: {},
  });
  await seedDemoClassroom();
  await seedDemoExtras();
  console.info("Demo data seeded. No real student or parent data was created.");
} finally {
  await db.$disconnect();
}
