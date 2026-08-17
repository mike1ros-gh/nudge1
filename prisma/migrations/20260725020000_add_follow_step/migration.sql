-- Adds an optional middle DM step ("please follow, then tap") between the
-- opening DM and the reveal, for campaigns that want that nudge.
ALTER TABLE "Automation" ADD COLUMN "followStepEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Automation" ADD COLUMN "followStepMessage" TEXT;
ALTER TABLE "Automation" ADD COLUMN "followStepButtonLabel" TEXT;
