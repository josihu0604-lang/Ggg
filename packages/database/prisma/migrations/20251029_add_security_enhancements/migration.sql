-- Migration: Add Security Enhancements
-- Date: 2025-10-29
-- Description: Adds Stripe webhook event tracking, QR code single-use enforcement

-- ========================================
-- 1. Create StripeWebhookEvent table (Idempotency)
-- ========================================

CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiVersion" TEXT,
    "data" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingTime" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on Stripe event ID (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS "StripeWebhookEvent_stripeEventId_key" 
ON "StripeWebhookEvent"("stripeEventId");

-- Index for querying by type
CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_type_createdAt_idx" 
ON "StripeWebhookEvent"("type", "createdAt");

-- Index for monitoring failed events
CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_success_createdAt_idx" 
ON "StripeWebhookEvent"("success", "createdAt");

-- ========================================
-- 2. Add single-use fields to QRCode table
-- ========================================

-- Add used flag (default false)
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "used" BOOLEAN NOT NULL DEFAULT false;

-- Add timestamp when QR code was used
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);

-- Add user ID who used the QR code
ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "usedByUserId" TEXT;

-- Add foreign key constraint to User table
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_usedByUserId_fkey" 
FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for querying unused QR codes
CREATE INDEX IF NOT EXISTS "QRCode_used_expiresAt_idx" 
ON "QRCode"("used", "expiresAt");

-- ========================================
-- 3. Update User table (add QRCode relation)
-- ========================================

-- No schema change needed - relation is virtual in Prisma

-- ========================================
-- Comments for documentation
-- ========================================

COMMENT ON TABLE "StripeWebhookEvent" IS 'Tracks all Stripe webhook events for idempotency and audit trail';
COMMENT ON COLUMN "StripeWebhookEvent"."stripeEventId" IS 'Unique Stripe event.id for deduplication';
COMMENT ON COLUMN "StripeWebhookEvent"."data" IS 'Full Stripe event payload as JSON';
COMMENT ON COLUMN "StripeWebhookEvent"."processingTime" IS 'Processing duration in milliseconds';

COMMENT ON COLUMN "QRCode"."used" IS 'Single-use enforcement flag - true after first successful scan';
COMMENT ON COLUMN "QRCode"."usedAt" IS 'Timestamp when QR code was used';
COMMENT ON COLUMN "QRCode"."usedByUserId" IS 'User who used this QR code (for audit trail)';
