-- AGENT XOTIRASI (AgentMemory) — Faza 2.
--
-- Agent har suhbatda noldan boshlamasligi uchun: bu yerga yozilgan faktlar
-- keyingi suhbatlarda system prompt'ga quyiladi.
--
-- `doira` = 'tenant' — butun tashkilotga tegishli fakt (userId NULL).
-- `doira` = 'user'   — faqat bitta xodimning shaxsiy sozlamasi (userId to'ldiriladi).

CREATE TABLE IF NOT EXISTS "AgentMemory" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "doira"     TEXT NOT NULL DEFAULT 'tenant',
    "userId"    TEXT,
    "mavzu"     TEXT NOT NULL,
    "matn"      TEXT NOT NULL,
    "manba"     TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- Prompt uchun o'qish va chegaradan oshganda eng eskisini topish shu indeks bo'yicha.
CREATE INDEX IF NOT EXISTS "AgentMemory_tenantId_doira_updatedAt_idx"
    ON "AgentMemory"("tenantId", "doira", "updatedAt");
CREATE INDEX IF NOT EXISTS "AgentMemory_tenantId_userId_idx"
    ON "AgentMemory"("tenantId", "userId");

ALTER TABLE "AgentMemory"
    DROP CONSTRAINT IF EXISTS "AgentMemory_tenantId_fkey";
ALTER TABLE "AgentMemory"
    ADD CONSTRAINT "AgentMemory_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
