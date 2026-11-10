-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL DEFAULT '',
    "href" VARCHAR(300) NOT NULL DEFAULT '',
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbsenceRequest_studentId_createdAt_idx" ON "AbsenceRequest"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_lessonId_studentId_key" ON "AbsenceRequest"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "StudentNote_classId_studentId_createdAt_idx" ON "StudentNote"("classId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentNote_studentId_createdAt_idx" ON "StudentNote"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fast unread badge lookups.
CREATE INDEX "Notification_unread_idx" ON "Notification"("userId") WHERE "readAt" IS NULL;

ALTER TABLE "AbsenceRequest"
  ADD CONSTRAINT "AbsenceRequest_reason_present" CHECK (length(btrim("reason")) > 0),
  ADD CONSTRAINT "AbsenceRequest_ack_complete" CHECK (("acknowledgedAt" IS NULL) = ("acknowledgedById" IS NULL));
ALTER TABLE "StudentNote"
  ADD CONSTRAINT "StudentNote_content_present" CHECK (length(btrim("content")) > 0);
