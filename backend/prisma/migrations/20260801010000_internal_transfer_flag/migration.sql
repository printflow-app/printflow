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
