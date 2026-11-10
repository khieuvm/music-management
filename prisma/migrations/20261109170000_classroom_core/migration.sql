-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('TALENT', 'SKILL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'NEEDS_REVISION', 'REVIEWED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- AlterTable
ALTER TABLE "ConsultationRequest" ADD COLUMN     "staffNote" VARCHAR(1000) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Course" RENAME COLUMN "instrument" TO "subject";
ALTER TABLE "Course" ADD COLUMN "category" "CourseCategory" NOT NULL DEFAULT 'TALENT';

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE,
    "parentName" VARCHAR(100) NOT NULL DEFAULT '',
    "parentPhone" VARCHAR(20) NOT NULL DEFAULT '',
    "parentEmail" VARCHAR(254) NOT NULL DEFAULT '',
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "userId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "subjects" VARCHAR(200) NOT NULL DEFAULT '',
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "userId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "courseId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "tuitionVnd" INTEGER NOT NULL,
    "location" VARCHAR(200) NOT NULL DEFAULT '',
    "meetingUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ClassStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "tuitionVnd" INTEGER NOT NULL,
    "enrolledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(3),
    "note" VARCHAR(500) NOT NULL DEFAULT '',

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeInstallment" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountVnd" INTEGER NOT NULL,

    CONSTRAINT "FeeInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "receiptNo" SERIAL NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "idempotencyKey" UUID NOT NULL,
    "receivedById" UUID NOT NULL,
    "voidedAt" TIMESTAMPTZ(3),
    "voidedById" UUID,
    "voidReason" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "topic" VARCHAR(300) NOT NULL DEFAULT '',
    "teacherNote" VARCHAR(1000) NOT NULL DEFAULT '',
    "cancelReason" VARCHAR(300) NOT NULL DEFAULT '',
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "comment" VARCHAR(1000) NOT NULL DEFAULT '',
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMPTZ(3),
    "requireVideo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "textAnswer" VARCHAR(2000) NOT NULL DEFAULT '',
    "videoFileId" UUID,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" INTEGER,
    "feedback" VARCHAR(2000) NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" VARCHAR(100) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_code_key" ON "Student"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_fullName_idx" ON "Student"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroup_code_key" ON "ClassGroup"("code");

-- CreateIndex
CREATE INDEX "ClassGroup_status_startDate_idx" ON "ClassGroup"("status", "startDate");

-- CreateIndex
CREATE INDEX "ClassGroup_teacherId_idx" ON "ClassGroup"("teacherId");

-- CreateIndex
CREATE INDEX "Enrollment_classId_status_idx" ON "Enrollment"("classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_classId_key" ON "Enrollment"("studentId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeInstallment_enrollmentId_sequence_key" ON "FeeInstallment"("enrollmentId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Lesson_classId_startsAt_idx" ON "Lesson"("classId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_startsAt_idx" ON "Lesson"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_startsAt_idx" ON "Lesson"("startsAt");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_studentId_key" ON "Attendance"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "Assignment_classId_createdAt_idx" ON "Assignment"("classId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_videoFileId_key" ON "Submission"("videoFileId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_attempt_key" ON "Submission"("assignmentId", "studentId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_ownerId_createdAt_idx" ON "StoredFile"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInstallment" ADD CONSTRAINT "FeeInstallment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_videoFileId_fkey" FOREIGN KEY ("videoFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Business integrity constraints (not expressible in Prisma schema)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "User"
  ADD CONSTRAINT "User_username_format" CHECK ("username" ~ '^[a-z0-9._-]{3,50}$');
ALTER TABLE "ClassGroup"
  ADD CONSTRAINT "ClassGroup_capacity_positive" CHECK ("capacity" > 0),
  ADD CONSTRAINT "ClassGroup_tuition_nonnegative" CHECK ("tuitionVnd" >= 0),
  ADD CONSTRAINT "ClassGroup_dates_ordered" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_tuition_nonnegative" CHECK ("tuitionVnd" >= 0);
ALTER TABLE "FeeInstallment"
  ADD CONSTRAINT "FeeInstallment_amount_nonnegative" CHECK ("amountVnd" >= 0),
  ADD CONSTRAINT "FeeInstallment_sequence_positive" CHECK ("sequence" > 0);
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountVnd" > 0),
  ADD CONSTRAINT "Payment_void_complete" CHECK (("voidedAt" IS NULL) = ("voidedById" IS NULL));
ALTER TABLE "Lesson"
  ADD CONSTRAINT "Lesson_time_ordered" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Lesson_teacher_no_overlap" EXCLUDE USING gist (
    "teacherId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  ) WHERE ("status" <> 'CANCELLED');
ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_attempt_positive" CHECK ("attempt" > 0),
  ADD CONSTRAINT "Submission_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10));
ALTER TABLE "StoredFile"
  ADD CONSTRAINT "StoredFile_size_positive" CHECK ("sizeBytes" > 0);
