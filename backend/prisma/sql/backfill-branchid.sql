-- =============================================
-- BACKFILL: Vendor.branchId + Service.branchId
-- Safe to re-run (idempotent on the new column / fresh data).
-- Does NOT enforce NOT NULL — that's left to `prisma db push`
-- after the data is consistent.
-- =============================================

-- 1. Ensure every tenant has a "Bosh Ofis (Asosiy)" branch.
INSERT INTO "Branch" ("id", "tenantId", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t."id", 'Bosh Ofis (Asosiy)', true, NOW(), NOW()
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Branch" b
  WHERE b."tenantId" = t."id" AND b."name" = 'Bosh Ofis (Asosiy)'
);

-- 2. Add Vendor.branchId as nullable first so the ALTER doesn't fail on existing rows.
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- 3. Backfill: assign every Vendor to its tenant's "Bosh Ofis (Asosiy)".
--   (Vendors can later be moved to a real branch via the UI.)
UPDATE "Vendor" v
SET "branchId" = (
  SELECT b."id" FROM "Branch" b
  WHERE b."tenantId" = v."tenantId"
    AND b."name" = 'Bosh Ofis (Asosiy)'
  LIMIT 1
)
WHERE v."branchId" IS NULL;

-- 4. Backfill Service.branchId for legacy null rows — same rule.
UPDATE "Service" s
SET "branchId" = (
  SELECT b."id" FROM "Branch" b
  WHERE b."tenantId" = s."tenantId"
    AND b."name" = 'Bosh Ofis (Asosiy)'
  LIMIT 1
)
WHERE s."branchId" IS NULL;
