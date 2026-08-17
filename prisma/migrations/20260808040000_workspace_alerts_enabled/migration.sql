-- Opt-in operational alert emails (worker health, token expiry, Redis usage).
ALTER TABLE "Workspace" ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT false;
