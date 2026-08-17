ALTER TABLE "Workspace" ALTER COLUMN "alertsEnabled" SET DEFAULT true;
UPDATE "Workspace" SET "alertsEnabled" = true WHERE "alertsEnabled" = false;
