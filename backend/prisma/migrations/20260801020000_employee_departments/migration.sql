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

ALTER TABLE "EmployeeDepartment"
    ADD CONSTRAINT "EmployeeDepartment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDepartment"
    ADD CONSTRAINT "EmployeeDepartment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDepartment"
    ADD CONSTRAINT "EmployeeDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
