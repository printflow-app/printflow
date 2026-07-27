-- AlterTable
ALTER TABLE "KanbanColumn" ADD COLUMN IF NOT EXISTS "isDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "aiCreditsGranted" INTEGER,
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'PLAN';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "aiMessagesPerDay" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canManageCashBoxes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canManagePayroll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canSetTransactionDate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canShowPriceList" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canTransferCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canUseAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canViewAllCashBoxes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canViewOwnCashOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canViewPayroll" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "aiExtraCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "cashBoxId" TEXT,
ADD COLUMN IF NOT EXISTS "createdById" TEXT,
ADD COLUMN IF NOT EXISTS "isSalaryAdvance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiUsageDaily" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiAnswerCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'llm',
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnswerCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "relatedEmployeeId" TEXT,
    "relatedCustomerId" TEXT,
    "relatedMaterialId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserLockSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "timeoutMinutes" INTEGER NOT NULL DEFAULT 5,
    "lockedTabs" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLockSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalaryScheme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT,
    "employeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "components" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalaryRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "period" TEXT NOT NULL,
    "fixedSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusNote" TEXT,
    "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyNote" TEXT,
    "advanceDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prevDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carriedDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "breakdown" JSONB,

    CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VendorLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashBox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "assignedUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromCashBoxId" TEXT NOT NULL,
    "toCashBoxId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "paymentTypeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "initiatedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "sourceTxId" TEXT,
    "destTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KpiPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "scope" TEXT NOT NULL,
    "roleId" TEXT,
    "employeeId" TEXT,
    "metricKey" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodType" TEXT NOT NULL DEFAULT 'monthly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiUsageDaily_tenantId_idx" ON "AiUsageDaily"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageDaily_tenantId_date_key" ON "AiUsageDaily"("tenantId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiAnswerCache_tenantId_expiresAt_idx" ON "AiAnswerCache"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiAnswerCache_tenantId_questionHash_key" ON "AiAnswerCache"("tenantId", "questionHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAction_tenantId_createdAt_idx" ON "AgentAction"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAction_userId_status_idx" ON "AgentAction"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiInsight_tenantId_status_idx" ON "AiInsight"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AiInsight_tenantId_dedupeKey_key" ON "AiInsight"("tenantId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserLockSetting_userId_key" ON "UserLockSetting"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryScheme_tenantId_idx" ON "SalaryScheme"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryScheme_roleId_idx" ON "SalaryScheme"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryScheme_employeeId_idx" ON "SalaryScheme"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryRecord_tenantId_period_idx" ON "SalaryRecord"("tenantId", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryRecord_employeeId_idx" ON "SalaryRecord"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SalaryRecord_tenantId_employeeId_period_key" ON "SalaryRecord"("tenantId", "employeeId", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VendorLedgerEntry_tenantId_idx" ON "VendorLedgerEntry"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VendorLedgerEntry_branchId_idx" ON "VendorLedgerEntry"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VendorLedgerEntry_vendorId_idx" ON "VendorLedgerEntry"("vendorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashBox_tenantId_idx" ON "CashBox"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashBox_branchId_idx" ON "CashBox"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashBox_assignedUserId_idx" ON "CashBox"("assignedUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashTransfer_tenantId_status_idx" ON "CashTransfer"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashTransfer_toCashBoxId_status_idx" ON "CashTransfer"("toCashBoxId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KpiPlan_tenantId_idx" ON "KpiPlan"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KpiPlan_tenantId_roleId_idx" ON "KpiPlan"("tenantId", "roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KpiPlan_tenantId_employeeId_idx" ON "KpiPlan"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_createdById_idx" ON "Transaction"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_cashBoxId_idx" ON "Transaction"("cashBoxId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiUsageDaily_tenantId_fkey') THEN
    ALTER TABLE "AiUsageDaily" ADD CONSTRAINT "AiUsageDaily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiAnswerCache_tenantId_fkey') THEN
    ALTER TABLE "AiAnswerCache" ADD CONSTRAINT "AiAnswerCache_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentAction_tenantId_fkey') THEN
    ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiInsight_tenantId_fkey') THEN
    ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryScheme_tenantId_fkey') THEN
    ALTER TABLE "SalaryScheme" ADD CONSTRAINT "SalaryScheme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryScheme_roleId_fkey') THEN
    ALTER TABLE "SalaryScheme" ADD CONSTRAINT "SalaryScheme_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryScheme_employeeId_fkey') THEN
    ALTER TABLE "SalaryScheme" ADD CONSTRAINT "SalaryScheme_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryRecord_tenantId_fkey') THEN
    ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalaryRecord_employeeId_fkey') THEN
    ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VendorLedgerEntry_tenantId_fkey') THEN
    ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VendorLedgerEntry_branchId_fkey') THEN
    ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VendorLedgerEntry_vendorId_fkey') THEN
    ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_cashBoxId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashBox_tenantId_fkey') THEN
    ALTER TABLE "CashBox" ADD CONSTRAINT "CashBox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashBox_branchId_fkey') THEN
    ALTER TABLE "CashBox" ADD CONSTRAINT "CashBox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashTransfer_tenantId_fkey') THEN
    ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashTransfer_fromCashBoxId_fkey') THEN
    ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_fromCashBoxId_fkey" FOREIGN KEY ("fromCashBoxId") REFERENCES "CashBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashTransfer_toCashBoxId_fkey') THEN
    ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_toCashBoxId_fkey" FOREIGN KEY ("toCashBoxId") REFERENCES "CashBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

