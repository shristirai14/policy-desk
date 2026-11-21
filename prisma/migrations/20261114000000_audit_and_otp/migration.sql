
-- AlterTable
ALTER TABLE "esign_authorization" ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rate_band" ALTER COLUMN "effectiveDate" SET DEFAULT '1900-01-01'::timestamp;

-- AlterTable
ALTER TABLE "rate_factor" ALTER COLUMN "effectiveDate" SET DEFAULT '1900-01-01'::timestamp;

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "detail" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

