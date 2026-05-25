ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'HR_MANAGER';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'PAYROLL_MANAGER';

CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'OTHER');
CREATE TYPE "WorkScheduleType" AS ENUM ('FIVE_TWO', 'TWO_TWO', 'SHIFT', 'FLEXIBLE', 'CUSTOM');
CREATE TYPE "WorkShiftStatus" AS ENUM ('PLANNED', 'WORKED', 'MISSED', 'LATE', 'SICK', 'VACATION', 'DAY_OFF');
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'SYSTEM', 'IMPORT');
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'CALCULATED', 'APPROVED', 'PAID', 'CLOSED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('BONUS', 'PENALTY', 'CORRECTION');
CREATE TYPE "CommissionSource" AS ENUM ('PAID_ORDERS', 'COMPLETED_ORDERS', 'PROFIT');

CREATE TABLE "EmployeeProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "position" TEXT,
  "department" TEXT,
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "hireDate" TIMESTAMP(3),
  "fireDate" TIMESTAMP(3),
  "baseSalary" DECIMAL(14,2),
  "hourlyRate" DECIMAL(14,2),
  "shiftRate" DECIMAL(14,2),
  "commissionRate" DECIMAL(5,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkSchedule" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorkScheduleType" NOT NULL DEFAULT 'FIVE_TWO',
  "workdayHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkShift" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "plannedStart" TIMESTAMP(3),
  "plannedEnd" TIMESTAMP(3),
  "actualStart" TIMESTAMP(3),
  "actualEnd" TIMESTAMP(3),
  "status" "WorkShiftStatus" NOT NULL DEFAULT 'PLANNED',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "totalMinutes" INTEGER NOT NULL DEFAULT 0,
  "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPeriod" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRun" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "calculatedById" TEXT,
  "approvedById" TEXT,
  "calculatedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalBonuses" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalPenalties" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalCommissions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLine" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "baseSalaryAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "hourlyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "shiftAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "overtimeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "bonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "penaltyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "workedHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "workedDays" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollAdjustment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "type" "PayrollAdjustmentType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "roleId" TEXT,
  "name" TEXT NOT NULL,
  "source" "CommissionSource" NOT NULL DEFAULT 'PAID_ORDERS',
  "percent" DECIMAL(5,2) NOT NULL,
  "minOrderAmount" DECIMAL(14,2),
  "productCategoryId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");
CREATE UNIQUE INDEX "EmployeeProfile_employeeNumber_key" ON "EmployeeProfile"("employeeNumber");
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_employeeId_key" ON "PayrollLine"("payrollRunId", "employeeId");

CREATE INDEX "EmployeeProfile_userId_idx" ON "EmployeeProfile"("userId");
CREATE INDEX "EmployeeProfile_employeeNumber_idx" ON "EmployeeProfile"("employeeNumber");
CREATE INDEX "EmployeeProfile_department_idx" ON "EmployeeProfile"("department");
CREATE INDEX "EmployeeProfile_position_idx" ON "EmployeeProfile"("position");
CREATE INDEX "EmployeeProfile_employmentType_idx" ON "EmployeeProfile"("employmentType");
CREATE INDEX "EmployeeProfile_isActive_idx" ON "EmployeeProfile"("isActive");
CREATE INDEX "EmployeeProfile_deletedAt_idx" ON "EmployeeProfile"("deletedAt");

CREATE INDEX "WorkSchedule_employeeId_idx" ON "WorkSchedule"("employeeId");
CREATE INDEX "WorkSchedule_type_idx" ON "WorkSchedule"("type");
CREATE INDEX "WorkSchedule_isActive_idx" ON "WorkSchedule"("isActive");
CREATE INDEX "WorkSchedule_deletedAt_idx" ON "WorkSchedule"("deletedAt");

CREATE INDEX "WorkShift_employeeId_idx" ON "WorkShift"("employeeId");
CREATE INDEX "WorkShift_scheduleId_idx" ON "WorkShift"("scheduleId");
CREATE INDEX "WorkShift_date_idx" ON "WorkShift"("date");
CREATE INDEX "WorkShift_status_idx" ON "WorkShift"("status");
CREATE INDEX "WorkShift_deletedAt_idx" ON "WorkShift"("deletedAt");

CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");
CREATE INDEX "TimeEntry_approvedById_idx" ON "TimeEntry"("approvedById");
CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");
CREATE INDEX "TimeEntry_deletedAt_idx" ON "TimeEntry"("deletedAt");

CREATE INDEX "PayrollPeriod_dateFrom_idx" ON "PayrollPeriod"("dateFrom");
CREATE INDEX "PayrollPeriod_dateTo_idx" ON "PayrollPeriod"("dateTo");
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");
CREATE INDEX "PayrollPeriod_deletedAt_idx" ON "PayrollPeriod"("deletedAt");

CREATE INDEX "PayrollRun_periodId_idx" ON "PayrollRun"("periodId");
CREATE INDEX "PayrollRun_calculatedById_idx" ON "PayrollRun"("calculatedById");
CREATE INDEX "PayrollRun_approvedById_idx" ON "PayrollRun"("approvedById");
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");
CREATE INDEX "PayrollRun_deletedAt_idx" ON "PayrollRun"("deletedAt");

CREATE INDEX "PayrollLine_payrollRunId_idx" ON "PayrollLine"("payrollRunId");
CREATE INDEX "PayrollLine_employeeId_idx" ON "PayrollLine"("employeeId");
CREATE INDEX "PayrollLine_deletedAt_idx" ON "PayrollLine"("deletedAt");

CREATE INDEX "PayrollAdjustment_employeeId_idx" ON "PayrollAdjustment"("employeeId");
CREATE INDEX "PayrollAdjustment_periodId_idx" ON "PayrollAdjustment"("periodId");
CREATE INDEX "PayrollAdjustment_type_idx" ON "PayrollAdjustment"("type");
CREATE INDEX "PayrollAdjustment_createdById_idx" ON "PayrollAdjustment"("createdById");
CREATE INDEX "PayrollAdjustment_deletedAt_idx" ON "PayrollAdjustment"("deletedAt");

CREATE INDEX "CommissionRule_employeeId_idx" ON "CommissionRule"("employeeId");
CREATE INDEX "CommissionRule_roleId_idx" ON "CommissionRule"("roleId");
CREATE INDEX "CommissionRule_source_idx" ON "CommissionRule"("source");
CREATE INDEX "CommissionRule_productCategoryId_idx" ON "CommissionRule"("productCategoryId");
CREATE INDEX "CommissionRule_isActive_idx" ON "CommissionRule"("isActive");
CREATE INDEX "CommissionRule_deletedAt_idx" ON "CommissionRule"("deletedAt");

ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_productCategoryId_fkey" FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
