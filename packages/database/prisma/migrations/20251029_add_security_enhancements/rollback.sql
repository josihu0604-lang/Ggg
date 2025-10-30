-- Rollback Migration: Add Security Enhancements
-- Date: 2025-10-29
-- Description: Reverts changes from add_security_enhancements migration

-- ========================================
-- WARNING: This will delete all data in StripeWebhookEvent table
-- Make sure to backup before running!
-- ========================================

BEGIN;

-- ========================================
-- 1. Remove single-use fields from QRCode table
-- ========================================

-- Drop foreign key constraint first
ALTER TABLE "QRCode" DROP CONSTRAINT IF EXISTS "QRCode_usedByUserId_fkey";

-- Drop index
DROP INDEX IF EXISTS "QRCode_used_expiresAt_idx";

-- Drop columns
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "usedByUserId";
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "usedAt";
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "used";

-- ========================================
-- 2. Drop StripeWebhookEvent table
-- ========================================

-- Drop indexes first
DROP INDEX IF EXISTS "StripeWebhookEvent_success_createdAt_idx";
DROP INDEX IF EXISTS "StripeWebhookEvent_type_createdAt_idx";
DROP INDEX IF EXISTS "StripeWebhookEvent_stripeEventId_key";

-- Drop table
DROP TABLE IF EXISTS "StripeWebhookEvent";

-- ========================================
-- Verify rollback
-- ========================================

-- Check that table is gone
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'StripeWebhookEvent'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: StripeWebhookEvent table still exists';
    END IF;
END$$;

-- Check that columns are gone
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'QRCode' 
        AND column_name IN ('used', 'usedAt', 'usedByUserId')
    ) THEN
        RAISE EXCEPTION 'Rollback failed: QRCode columns still exist';
    END IF;
END$$;

COMMIT;

-- ========================================
-- Post-rollback steps (manual)
-- ========================================

-- 1. Restart application to clear Prisma Client cache
-- 2. Regenerate Prisma Client:
--    npx prisma generate
-- 3. Verify application health checks
-- 4. Monitor error rates for 15 minutes
