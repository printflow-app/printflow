-- Read-only diagnostic — no writes, safe to run any time.
SELECT 'Vendor rows total' AS metric, COUNT(*)::text AS value FROM "Vendor"
UNION ALL
SELECT 'Service rows total', COUNT(*)::text FROM "Service"
UNION ALL
SELECT 'Service rows with NULL branchId', COUNT(*)::text FROM "Service" WHERE "branchId" IS NULL
UNION ALL
SELECT 'Tenants total', COUNT(*)::text FROM "Tenant"
UNION ALL
SELECT 'Tenants WITHOUT any Branch', COUNT(*)::text FROM "Tenant" t
  WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."tenantId" = t."id");
