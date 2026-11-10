-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "ClassFormat" AS ENUM ('GROUP', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('NEW', 'CONTACTING', 'ENROLLED', 'CLOSED');

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "audience" VARCHAR(300) NOT NULL,
    "instrument" VARCHAR(50) NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "format" "ClassFormat" NOT NULL,
    "referenceFeeVnd" INTEGER,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRequest" (
    "id" UUID NOT NULL,
    "contactName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "courseId" UUID,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "ConsultationStatus" NOT NULL DEFAULT 'NEW',
    "privacyVersion" VARCHAR(30) NOT NULL,
    "consentedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" VARCHAR(100) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_createdAt_idx" ON "Course"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_deliveryMode_format_key" ON "CourseOffering"("courseId", "deliveryMode", "format");

-- CreateIndex
CREATE INDEX "ConsultationRequest_status_createdAt_idx" ON "ConsultationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
