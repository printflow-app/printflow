-- Jamoa doskasi: operatsion vazifalar + ular uchun ruxsatlar.
--
-- Buyurtma kanbanidan alohida: u yerda fokus buyurtmada, bu yerda
-- xodimning bandligida. Shuning uchun alohida jadval va alohida ruxsat.

CREATE TABLE IF NOT EXISTS "TeamTask" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "branchId"    TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "assigneeId"  TEXT,
    "status"      TEXT NOT NULL DEFAULT 'reja',
    "deadlineAt"  TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamTask_tenantId_status_idx" ON "TeamTask" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "TeamTask_assigneeId_idx"      ON "TeamTask" ("assigneeId");

-- FK'lar guard bilan — ADD CONSTRAINT'da IF NOT EXISTS yo'q, guardsiz
-- migratsiya ikkinchi marta ishga tushirilganda yiqilardi.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamTask_tenantId_fkey') THEN
    ALTER TABLE "TeamTask"
      ADD CONSTRAINT "TeamTask_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamTask_assigneeId_fkey') THEN
    ALTER TABLE "TeamTask"
      ADD CONSTRAINT "TeamTask_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ruxsatlar. Sukut bo'yicha FALSE — mavjud rollar yangi sahifani
-- avtomatik ochib yubormasligi kerak; rahbar ongli ravishda beradi.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewTeamTasks"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canManageTeamTasks" BOOLEAN NOT NULL DEFAULT false;
