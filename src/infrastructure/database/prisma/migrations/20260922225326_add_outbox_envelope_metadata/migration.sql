-- Metadados do envelope de evento no outbox.
-- Linhas existentes foram gravadas no formato v1 (schemaVersion dentro do
-- payload) e nao tinham correlationId: backfill com schemaVersion = 1 e
-- correlationId = id do proprio evento, depois remove os defaults para que
-- toda linha nova informe os dois valores explicitamente.

-- AlterTable
ALTER TABLE "outbox_events"
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "outbox_events" SET "correlationId" = "id" WHERE "correlationId" IS NULL;

ALTER TABLE "outbox_events"
  ALTER COLUMN "correlationId" SET NOT NULL,
  ALTER COLUMN "schemaVersion" DROP DEFAULT;

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "outbox_events_schema_version_positive" CHECK ("schemaVersion" > 0);
