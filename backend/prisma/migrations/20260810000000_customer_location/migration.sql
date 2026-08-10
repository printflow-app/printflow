-- MIJOZ MANZILI VA XARITADAGI NUQTASI.
--
-- `address` — odam o'qiydigan matn. `latitude`/`longitude` — xaritadagi
-- nuqta; ular manzil matnidan avtomatik chiqmaydi, chunki O'zbekiston
-- manzillari ochiq geokoderlarda (Nominatim/OSM) yaxshi topilmaydi —
-- nuqta xaritadan qo'lda belgilanadi.
--
-- Uchalasi ham NULL bo'lishi mumkin: mavjud mijozlarda ular yo'q va
-- manzilni keyinchalik, kerak bo'lganda kiritish mumkin.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
