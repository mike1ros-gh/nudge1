-- SKIPPED_DEDUP was never actually set by the worker (dead status), and
-- SKIPPED_PLAN_LIMIT became unreachable once the monthly send cap was
-- raised to an effectively-infinite value after billing was removed.
-- Confirmed zero DmLog rows use either value before writing this migration.
-- Postgres has no direct "drop enum value", so rebuild the type.
BEGIN;

ALTER TYPE "DmStatus" RENAME TO "DmStatus_old";

CREATE TYPE "DmStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_RATE_LIMIT', 'SKIPPED_NO_MATCH');

ALTER TABLE "DmLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DmLog" ALTER COLUMN "status" TYPE "DmStatus" USING ("status"::text::"DmStatus");
ALTER TABLE "DmLog" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "DmStatus_old";

COMMIT;
