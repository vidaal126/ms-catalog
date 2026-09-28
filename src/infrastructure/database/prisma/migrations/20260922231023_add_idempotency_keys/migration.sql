-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CHECK constraints (adicionados a mao; o Prisma nao os modela).
ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_key_length" CHECK (char_length("key") BETWEEN 1 AND 255),
  ADD CONSTRAINT "idempotency_keys_status_valid" CHECK ("status" IN ('in_progress', 'completed')),
  ADD CONSTRAINT "idempotency_keys_completed_has_response" CHECK (
    "status" <> 'completed' OR ("responseStatus" IS NOT NULL AND "responseBody" IS NOT NULL)
  ),
  ADD CONSTRAINT "idempotency_keys_expires_after_lock" CHECK ("expiresAt" > "lockedAt");
