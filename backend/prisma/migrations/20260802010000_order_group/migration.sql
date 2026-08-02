-- Bitta buyurtmadagi xizmatlarni bog'lovchi kalit.
--
-- Bir buyurtma bir necha xizmatdan iborat bo'lsa, har xizmat alohida Task
-- bo'ladi. KPI "har buyurtmadan 10 000 so'm" deb belgilanganda 3 xizmatli
-- buyurtma 30 000 so'm berardi — aslida u BITTA buyurtma.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "orderGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Task_orderGroupId_idx" ON "Task" ("orderGroupId");
