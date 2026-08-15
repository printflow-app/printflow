-- Buyurtmani tashkilotning qaysi vakili bergani.
-- Vakil o'chirilsa buyurtma yo'qolmasligi kerak → ON DELETE SET NULL.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "customerContactId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_customerContactId_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_customerContactId_fkey"
      FOREIGN KEY ("customerContactId") REFERENCES "CustomerContact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Task_customerContactId_idx" ON "Task"("customerContactId");
