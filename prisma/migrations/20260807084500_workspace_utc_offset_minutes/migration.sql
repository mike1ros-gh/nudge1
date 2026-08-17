-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "timezone",
ADD COLUMN     "utcOffsetMinutes" INTEGER NOT NULL DEFAULT 480;
