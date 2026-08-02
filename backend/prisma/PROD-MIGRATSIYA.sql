-- PrintFlow — prod bazaga qo'llash uchun birlashtirilgan migratsiya
-- 9c8e306 commit uchun. Hammasi IF NOT EXISTS — qayta ishga tushirish xavfsiz.
BEGIN;

-- ═══ 20260801000000_customer_contact_match_ui ═══
-- CustomerContact maydonlarini Mijozlar sahifasidagi forma bilan moslash.
--
-- Ilgari jadval firstName/lastName ustunlarini talab qilardi, UI esa
-- name/role/email yuborardi. Natijada kontakt qo'shish har doim xato
-- berardi va jadvalda birorta yozuv saqlanmagan — shuning uchun
-- ma'lumot yo'qotish xavfi yo'q.

ALTER TABLE "CustomerContact" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "CustomerContact" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "CustomerContact" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Eski yozuv bo'lsa (bo'lmasligi kerak) ismini ko'chiramiz, keyin NOT NULL.
-- Eski ustun hali mavjud bo'lsa ismni ko'chiramiz. Guard shart:
-- bu migratsiya firstName ni o'chiradi, ya'ni ikkinchi marta ishga
-- tushirilganda ustun endi yo'q va guardsiz so'rov yiqilardi.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'CustomerContact' AND column_name = 'firstName') THEN
    UPDATE "CustomerContact"
       SET "name" = COALESCE(NULLIF(TRIM(CONCAT_WS(' ', "firstName", "lastName")), ''), 'Kontakt')
     WHERE "name" IS NULL;
  END IF;
  UPDATE "CustomerContact" SET "name" = 'Kontakt' WHERE "name" IS NULL;
END $$;

ALTER TABLE "CustomerContact" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "CustomerContact" DROP COLUMN IF EXISTS "firstName";
ALTER TABLE "CustomerContact" DROP COLUMN IF EXISTS "lastName";

-- ═══ 20260801010000_internal_transfer_flag ═══
-- Kassalar orasidagi ichki o'tkazmani daromad/xarajatdan ajratish.
--
-- O'tkazma ikkita tranzaksiya qoldiradi: yuboruvchi kassada chiqim,
-- qabul qiluvchida kirim. Kassa qoldig'i uchun ikkalasi ham kerak, lekin
-- hisobotlarda ular kompaniya daromadi/xarajati sifatida sanalmasligi kerak.

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

-- Mavjud o'tkazmalarni belgilaymiz: CashTransfer ikkala tomonni ko'rsatadi.
UPDATE "Transaction" t
   SET "isInternalTransfer" = true
  FROM "CashTransfer" ct
 WHERE t."id" = ct."sourceTxId" OR t."id" = ct."destTxId";

CREATE INDEX IF NOT EXISTS "Transaction_isInternalTransfer_idx"
  ON "Transaction" ("isInternalTransfer");

-- ═══ 20260801020000_employee_departments ═══
-- Xodim ↔ bo'lim bog'lanishi (ko'pga-ko'p).
--
-- Bitta xodim bir vaqtning o'zida bir nechta bo'limda ishlashi mumkin,
-- shuning uchun Employee.departmentId emas, alohida jadval.

CREATE TABLE IF NOT EXISTS "EmployeeDepartment" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "employeeId"   TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDepartment_employeeId_departmentId_key"
    ON "EmployeeDepartment" ("employeeId", "departmentId");
CREATE INDEX IF NOT EXISTS "EmployeeDepartment_tenantId_idx"     ON "EmployeeDepartment" ("tenantId");
CREATE INDEX IF NOT EXISTS "EmployeeDepartment_employeeId_idx"   ON "EmployeeDepartment" ("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDepartment_departmentId_idx" ON "EmployeeDepartment" ("departmentId");

DO $$ BEGIN
  ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══ 20260802000000_team_tasks ═══
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

DO $$ BEGIN
  ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamTask" ADD CONSTRAINT "TeamTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ruxsatlar. Sukut bo'yicha FALSE — mavjud rollar yangi sahifani
-- avtomatik ochib yubormasligi kerak; rahbar ongli ravishda beradi.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewTeamTasks"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canManageTeamTasks" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
