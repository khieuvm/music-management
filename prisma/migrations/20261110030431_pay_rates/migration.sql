-- CreateTable
CREATE TABLE "PayRate" (
    "id" UUID NOT NULL,
    "teacherId" UUID,
    "effectiveFrom" DATE NOT NULL,
    "hourlyVnd" INTEGER NOT NULL,
    "eveningExtraVnd" INTEGER NOT NULL DEFAULT 0,
    "weekendExtraVnd" INTEGER NOT NULL DEFAULT 0,
    "perLessonVnd" INTEGER NOT NULL DEFAULT 0,
    "eveningStartMinutes" INTEGER NOT NULL DEFAULT 1080,
    "note" VARCHAR(300) NOT NULL DEFAULT '',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayRate_teacherId_effectiveFrom_key" ON "PayRate"("teacherId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NULL teacherId (centre default) is not covered by the unique index above.
CREATE UNIQUE INDEX "PayRate_default_effectiveFrom_key" ON "PayRate"("effectiveFrom") WHERE "teacherId" IS NULL;
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_amounts_valid" CHECK (
  "hourlyVnd" >= 0 AND "eveningExtraVnd" >= 0 AND "weekendExtraVnd" >= 0 AND "perLessonVnd" >= 0
  AND "eveningStartMinutes" BETWEEN 0 AND 1439
);
