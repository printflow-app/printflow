-- Zararsizlik nuqtasini ko'rish ruxsati.
--
-- Alohida ruxsat, chunki bu tashkilotning eng nozik moliyaviy ma'lumoti:
-- butun xarajat tarkibi va foydaga chiqish chegarasi. Umumiy "hisobotlarni
-- ko'rish" huquqi bilan birga berilmasligi kerak.

ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewBreakEven" BOOLEAN NOT NULL DEFAULT false;
