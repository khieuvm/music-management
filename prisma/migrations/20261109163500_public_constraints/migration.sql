ALTER TABLE "CourseOffering"
  ADD CONSTRAINT "CourseOffering_referenceFeeVnd_nonnegative"
  CHECK ("referenceFeeVnd" IS NULL OR "referenceFeeVnd" >= 0);

ALTER TABLE "RateLimitBucket"
  ADD CONSTRAINT "RateLimitBucket_count_positive" CHECK ("count" > 0);
