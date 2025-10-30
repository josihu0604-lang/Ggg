# Database Migration Strategy

## Overview

This document outlines the production-ready database migration strategy for ZZIK v2, ensuring zero-downtime deployments with rollback capabilities.

## Migration Workflow

### Development Environment

```bash
# 1. Make schema changes in schema.prisma
vim packages/database/prisma/schema.prisma

# 2. Generate migration (creates SQL files)
cd packages/database
npx prisma migrate dev --name descriptive_migration_name

# 3. Review generated SQL
cat prisma/migrations/YYYYMMDDHHMMSS_descriptive_migration_name/migration.sql

# 4. Test migration locally
npx prisma migrate reset  # Reset to clean state
npx prisma migrate dev    # Re-run all migrations

# 5. Generate Prisma Client
npx prisma generate
```

### Staging Environment

```bash
# 1. Deploy code with migration files
git push origin staging

# 2. Run migrations (DO NOT use db push)
cd packages/database
npx prisma migrate deploy

# 3. Verify migration success
npx prisma migrate status

# 4. Run smoke tests
npm run test:integration

# 5. Monitor for errors
tail -f logs/application.log
```

### Production Environment

```bash
# 1. Backup database BEFORE migration
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Verify backup
pg_restore --list backup_*.dump | head -20

# 3. Run migrations with transaction (atomic)
cd packages/database
npx prisma migrate deploy

# 4. Verify migration status
npx prisma migrate status

# 5. Run health checks
curl https://api.zzik.app/api/metrics

# 6. Monitor error rates (Sentry/DataDog)
# Check for spike in errors

# 7. If issues detected, ROLLBACK
# See "Rollback Procedure" below
```

## Rollback Procedure

### Option 1: Revert Migration (Safe)

```bash
# 1. Identify failed migration
npx prisma migrate status

# 2. Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backup_YYYYMMDD_HHMMSS.dump

# 3. Verify restoration
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM \"User\";"

# 4. Rollback code deployment
git revert HEAD
git push origin production

# 5. Restart application
kubectl rollout undo deployment/zzik-api
# OR
pm2 reload all
```

### Option 2: Forward Migration (Recommended)

```bash
# 1. Create rollback migration
cd packages/database
npx prisma migrate dev --name rollback_problematic_migration

# 2. Write SQL to undo changes
vim prisma/migrations/YYYYMMDD_rollback/migration.sql

# Example: Undo column addition
# DROP COLUMN IF EXISTS "newColumn" FROM "Table";

# 3. Deploy rollback migration
npx prisma migrate deploy

# 4. Verify
npx prisma migrate status
```

## Migration Best Practices

### 1. Additive Migrations (Safe)

✅ **SAFE** (No downtime):
- Adding new tables
- Adding nullable columns
- Adding indexes (with CONCURRENT)
- Creating new relationships

```sql
-- Safe: Add nullable column
ALTER TABLE "User" ADD COLUMN "newField" TEXT;

-- Safe: Add index concurrently (PostgreSQL)
CREATE INDEX CONCURRENTLY "User_email_idx" ON "User"("email");
```

### 2. Destructive Migrations (Dangerous)

⚠️ **REQUIRES CAREFUL PLANNING**:
- Dropping columns
- Dropping tables
- Renaming columns
- Changing column types
- Adding NOT NULL constraints

```sql
-- DANGEROUS: Requires multi-step migration
-- Step 1: Add new column
ALTER TABLE "User" ADD COLUMN "newEmail" TEXT;

-- Step 2: Backfill data (application code)
UPDATE "User" SET "newEmail" = "email";

-- Step 3: Make NOT NULL (after backfill complete)
ALTER TABLE "User" ALTER COLUMN "newEmail" SET NOT NULL;

-- Step 4: Drop old column (after verification)
ALTER TABLE "User" DROP COLUMN "email";
```

### 3. Multi-Step Migration Pattern

For breaking changes, use 3-phase deployment:

**Phase 1: Expand (Additive)**
```sql
-- Add new schema alongside old
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
```

**Phase 2: Dual-Write (Application Code)**
```typescript
// Write to both old and new columns
await prisma.user.update({
  data: {
    phone: newPhone,      // Old column
    phoneNumber: newPhone // New column
  }
});
```

**Phase 3: Contract (Remove Old)**
```sql
-- After verification, remove old schema
ALTER TABLE "User" DROP COLUMN "phone";
```

## Current Migrations

### Migration: Add Webhook Event Tracking (2025-10-29)

**File**: `20251029_add_stripe_webhook_event.sql`

**Changes**:
- Add `StripeWebhookEvent` table for idempotency
- Add `used`, `usedAt`, `usedByUserId` to `QRCode` table

**Rollback**:
```sql
DROP TABLE IF EXISTS "StripeWebhookEvent";
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "used";
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "usedAt";
ALTER TABLE "QRCode" DROP COLUMN IF EXISTS "usedByUserId";
```

## Monitoring During Migration

### Key Metrics to Watch

1. **Error Rate**
   - Target: <0.1% increase
   - Alert if: >1% spike

2. **Database Connections**
   - Monitor: Active connections
   - Alert if: >80% pool utilization

3. **Query Performance**
   - Monitor: P95 latency
   - Alert if: >2x baseline

4. **Application Health**
   - Monitor: HTTP 500 errors
   - Alert if: >10 errors/minute

### Monitoring Commands

```bash
# Check active connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check long-running queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT pid, now() - query_start as duration, query 
      FROM pg_stat_activity 
      WHERE state = 'active' AND now() - query_start > interval '5 seconds';"

# Check table sizes
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT schemaname, tablename, 
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## Emergency Rollback Checklist

- [ ] Database backup verified and accessible
- [ ] Rollback SQL script prepared and tested
- [ ] Application code rollback plan ready
- [ ] Team notified of rollback decision
- [ ] Customer support notified (if user-facing)
- [ ] Execute database restore
- [ ] Deploy previous application version
- [ ] Verify health checks passing
- [ ] Verify critical user flows working
- [ ] Post-mortem scheduled

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Database Migration

on:
  push:
    branches: [main, production]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Check migration status
        run: npx prisma migrate status
        working-directory: packages/database
      
      - name: Run migrations (production)
        if: github.ref == 'refs/heads/production'
        run: npx prisma migrate deploy
        working-directory: packages/database
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
      
      - name: Verify migration
        run: npx prisma migrate status
        working-directory: packages/database
      
      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: '🚨 Database migration failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Testing Migrations

### Unit Tests

```typescript
// packages/database/src/__tests__/migrations.test.ts
import { PrismaClient } from '@prisma/client';

describe('Migration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have StripeWebhookEvent table', async () => {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'StripeWebhookEvent'
      );
    `;
    expect(result).toBeTruthy();
  });

  it('should have QRCode.used column', async () => {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'QRCode' 
        AND column_name = 'used'
      );
    `;
    expect(result).toBeTruthy();
  });
});
```

### Integration Tests

```bash
# Test migration on clean database
docker run -d --name postgres-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15
export DATABASE_URL="postgresql://postgres:test@localhost:5433/test"

# Run migrations
npx prisma migrate deploy

# Run tests
npm run test:integration

# Cleanup
docker stop postgres-test && docker rm postgres-test
```

## Production Checklist

### Pre-Migration

- [ ] Database backup created and verified
- [ ] Staging migration successful
- [ ] Integration tests passing
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Monitoring dashboards ready
- [ ] Off-hours deployment scheduled (if possible)

### During Migration

- [ ] Application in maintenance mode (if needed)
- [ ] Migration command executed
- [ ] Migration status verified
- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Sample queries tested

### Post-Migration

- [ ] Application restored to normal mode
- [ ] Full smoke test executed
- [ ] Performance metrics reviewed
- [ ] User feedback monitored
- [ ] Backup retained for 30 days
- [ ] Migration documented in changelog

## Contact

For migration issues, contact:
- **Dev Lead**: @engineering-lead
- **DBA**: @database-admin  
- **On-Call**: See PagerDuty rotation

## Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
- [Zero-Downtime Migrations](https://engineering.fb.com/2014/11/11/core-data/online-schema-changes-for-mysql/)
