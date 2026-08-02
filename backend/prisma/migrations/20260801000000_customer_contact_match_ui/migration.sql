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
UPDATE "CustomerContact"
   SET "name" = COALESCE(NULLIF(TRIM(CONCAT_WS(' ', "firstName", "lastName")), ''), 'Kontakt')
 WHERE "name" IS NULL;

ALTER TABLE "CustomerContact" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "CustomerContact" DROP COLUMN IF EXISTS "firstName";
ALTER TABLE "CustomerContact" DROP COLUMN IF EXISTS "lastName";
