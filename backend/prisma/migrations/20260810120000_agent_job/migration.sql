-- FON TOPSHIRIQLARI (AgentJob) — Faza 3.
--
-- Chat javobi HTTP so'rovi ichida tugashi kerak, topshiriq esa daqiqalar
-- davom etishi mumkin. Shu sababli topshiriq alohida jadvalga yoziladi va
-- cron runner uni so'rovdan mustaqil bajaradi.
--
-- Bajarish davomida qilingan har amal odatdagidek "AgentAction" ga tushadi —
-- bu jadval amallarni emas, TOPSHIRIQNI kuzatadi.

CREATE TABLE IF NOT EXISTS "AgentJob" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "topshiriq"  TEXT NOT NULL,
    "sarlavha"   TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'queued',
    "progress"   JSONB,
    "natija"     TEXT,
    "error"      TEXT,
    "qadamlar"   INTEGER NOT NULL DEFAULT 0,
    "narxUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt"  TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- Runner navbatni shu indeks bo'yicha oladi (status='queued', eng eskisi birinchi).
CREATE INDEX IF NOT EXISTS "AgentJob_status_createdAt_idx" ON "AgentJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentJob_tenantId_createdAt_idx" ON "AgentJob"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentJob_userId_status_idx" ON "AgentJob"("userId", "status");

-- Tenant o'chirilsa uning topshiriqlari ham ketadi — yetim yozuv qolmasin.
ALTER TABLE "AgentJob"
    DROP CONSTRAINT IF EXISTS "AgentJob_tenantId_fkey";
ALTER TABLE "AgentJob"
    ADD CONSTRAINT "AgentJob_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
