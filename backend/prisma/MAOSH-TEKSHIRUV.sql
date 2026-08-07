-- ============================================================
-- MAOSH XATOSINI ANIQLASH — Nuqta Print (vodiyprint)
--
-- Railway → Postgres → Query oynasida ishga tushiring.
-- Faqat O'QIYDI, hech narsa o'zgartirmaydi.
-- ============================================================

-- ── 1. Qaysi xodim shu oyda qaysi buyurtmalarda qatnashgan ──
-- Bu jadval "kim qanday summadan hisob olgan" degan savolga javob beradi.
SELECT
    e."fullName"                         AS xodim,
    r."name"                             AS lavozim,
    t."displayId",
    COALESCE(t."orderName", t."title")   AS buyurtma,
    t."totalAmount"                      AS summa,
    t."completedAt"::date                AS bajarilgan,
    t."createdAt"::date                  AS qabul_qilingan,
    (SELECT COUNT(*) FROM jsonb_array_elements_text(t."assignees"::jsonb)) AS masullar_soni
FROM "Task" t
JOIN "Tenant" tn ON tn."id" = t."tenantId"
JOIN "Employee" e ON e."tenantId" = t."tenantId"
                 AND t."assignees"::jsonb ? e."id"
LEFT JOIN "Role" r ON r."id" = e."roleId"
WHERE tn."slug" = 'vodiyprint'
  AND t."isArchived" = false
  AND t."completedAt" >= date_trunc('month', CURRENT_DATE)
ORDER BY e."fullName", t."completedAt";

-- ── 2. Har xodimning shu oygi JAMI ko'rsatkichlari ──
-- KPI shu raqamlardan hisoblanadi.
SELECT
    e."fullName"                AS xodim,
    COUNT(*)                    AS ishlar_soni,
    COUNT(DISTINCT COALESCE(t."orderGroupId", t."id")) AS buyurtmalar_soni,
    SUM(t."totalAmount")        AS jami_summa,
    SUM(t."quantity")           AS jami_dona
FROM "Task" t
JOIN "Tenant" tn ON tn."id" = t."tenantId"
JOIN "Employee" e ON e."tenantId" = t."tenantId"
                 AND t."assignees"::jsonb ? e."id"
WHERE tn."slug" = 'vodiyprint'
  AND t."isArchived" = false
  AND t."completedAt" >= date_trunc('month', CURRENT_DATE)
GROUP BY e."fullName"
ORDER BY jami_summa DESC;

-- ── 3. Kimga qanday maosh sxemasi qo'llanmoqda ──
-- Shaxsiy sxema lavozim sxemasidan ustun turadi.
SELECT
    COALESCE(e."fullName", '— lavozim: ' || r."name") AS kimga,
    CASE WHEN s."employeeId" IS NOT NULL THEN 'shaxsiy' ELSE 'lavozim' END AS turi,
    s."components"
FROM "SalaryScheme" s
JOIN "Tenant" tn ON tn."id" = s."tenantId"
LEFT JOIN "Employee" e ON e."id" = s."employeeId"
LEFT JOIN "Role" r ON r."id" = s."roleId"
WHERE tn."slug" = 'vodiyprint';

-- ── 4. KPI boshlanish sanasi qo'yilganmi ──
SELECT s."key", s."value"
FROM "SystemSetting" s
JOIN "Tenant" tn ON tn."id" = s."tenantId"
WHERE tn."slug" = 'vodiyprint'
  AND s."key" IN ('KPI_START_DATE', 'workDays', 'workStart', 'workEnd');
