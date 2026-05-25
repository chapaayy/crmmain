CREATE TYPE "ResponsibilityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ResponsibilityAssignmentRole" AS ENUM ('OWNER', 'BACKUP', 'PARTICIPANT', 'VIEWER');
CREATE TYPE "ResponsibilityInstructionFormat" AS ENUM ('MARKDOWN', 'PLAIN_TEXT');
CREATE TYPE "SecretVaultItemType" AS ENUM ('LOGIN_PASSWORD', 'API_KEY', 'TOKEN', 'CARD_INFO', 'EMAIL_ACCOUNT', 'TELEGRAM_ACCOUNT', 'HOSTING', 'OTHER');
CREATE TYPE "SecretAccessAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'REVEALED', 'METADATA_VIEWED');

ALTER TABLE "Task" ADD COLUMN "assigneeEmployeeId" TEXT;
ALTER TABLE "Task" ADD COLUMN "assigneeDepartment" TEXT;
ALTER TABLE "Task" ADD COLUMN "responsibilityId" TEXT;
ALTER TABLE "Task" ADD COLUMN "isEmployeeTask" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Responsibility" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "status" "ResponsibilityStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerUserId" TEXT,
  "ownerEmployeeId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResponsibilityAssignment" (
  "id" TEXT NOT NULL,
  "responsibilityId" TEXT NOT NULL,
  "employeeId" TEXT,
  "userId" TEXT,
  "role" "ResponsibilityAssignmentRole" NOT NULL DEFAULT 'PARTICIPANT',
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResponsibilityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResponsibilityInstruction" (
  "id" TEXT NOT NULL,
  "responsibilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "format" "ResponsibilityInstructionFormat" NOT NULL DEFAULT 'MARKDOWN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResponsibilityInstruction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResponsibilityChecklistItem" (
  "id" TEXT NOT NULL,
  "responsibilityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResponsibilityChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretVaultItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "SecretVaultItemType" NOT NULL DEFAULT 'OTHER',
  "url" TEXT,
  "username" TEXT,
  "login" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "encryptedSecret" TEXT,
  "encryptedNotes" TEXT,
  "responsibilityId" TEXT,
  "ownerUserId" TEXT,
  "ownerEmployeeId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecretVaultItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretAccessLog" (
  "id" TEXT NOT NULL,
  "secretId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "SecretAccessAction" NOT NULL,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_assigneeEmployeeId_idx" ON "Task"("assigneeEmployeeId");
CREATE INDEX "Task_assigneeDepartment_idx" ON "Task"("assigneeDepartment");
CREATE INDEX "Task_responsibilityId_idx" ON "Task"("responsibilityId");
CREATE INDEX "Task_isEmployeeTask_idx" ON "Task"("isEmployeeTask");

CREATE INDEX "Responsibility_ownerUserId_idx" ON "Responsibility"("ownerUserId");
CREATE INDEX "Responsibility_ownerEmployeeId_idx" ON "Responsibility"("ownerEmployeeId");
CREATE INDEX "Responsibility_createdById_idx" ON "Responsibility"("createdById");
CREATE INDEX "Responsibility_category_idx" ON "Responsibility"("category");
CREATE INDEX "Responsibility_status_idx" ON "Responsibility"("status");
CREATE INDEX "Responsibility_deletedAt_idx" ON "Responsibility"("deletedAt");

CREATE INDEX "ResponsibilityAssignment_responsibilityId_idx" ON "ResponsibilityAssignment"("responsibilityId");
CREATE INDEX "ResponsibilityAssignment_employeeId_idx" ON "ResponsibilityAssignment"("employeeId");
CREATE INDEX "ResponsibilityAssignment_userId_idx" ON "ResponsibilityAssignment"("userId");
CREATE INDEX "ResponsibilityAssignment_role_idx" ON "ResponsibilityAssignment"("role");
CREATE INDEX "ResponsibilityAssignment_assignedById_idx" ON "ResponsibilityAssignment"("assignedById");

CREATE INDEX "ResponsibilityInstruction_responsibilityId_idx" ON "ResponsibilityInstruction"("responsibilityId");
CREATE INDEX "ResponsibilityInstruction_isActive_idx" ON "ResponsibilityInstruction"("isActive");
CREATE INDEX "ResponsibilityInstruction_createdById_idx" ON "ResponsibilityInstruction"("createdById");
CREATE INDEX "ResponsibilityInstruction_updatedById_idx" ON "ResponsibilityInstruction"("updatedById");

CREATE INDEX "ResponsibilityChecklistItem_responsibilityId_idx" ON "ResponsibilityChecklistItem"("responsibilityId");
CREATE INDEX "ResponsibilityChecklistItem_sortOrder_idx" ON "ResponsibilityChecklistItem"("sortOrder");

CREATE INDEX "SecretVaultItem_responsibilityId_idx" ON "SecretVaultItem"("responsibilityId");
CREATE INDEX "SecretVaultItem_ownerUserId_idx" ON "SecretVaultItem"("ownerUserId");
CREATE INDEX "SecretVaultItem_ownerEmployeeId_idx" ON "SecretVaultItem"("ownerEmployeeId");
CREATE INDEX "SecretVaultItem_createdById_idx" ON "SecretVaultItem"("createdById");
CREATE INDEX "SecretVaultItem_updatedById_idx" ON "SecretVaultItem"("updatedById");
CREATE INDEX "SecretVaultItem_type_idx" ON "SecretVaultItem"("type");
CREATE INDEX "SecretVaultItem_deletedAt_idx" ON "SecretVaultItem"("deletedAt");

CREATE INDEX "SecretAccessLog_secretId_idx" ON "SecretAccessLog"("secretId");
CREATE INDEX "SecretAccessLog_userId_idx" ON "SecretAccessLog"("userId");
CREATE INDEX "SecretAccessLog_action_idx" ON "SecretAccessLog"("action");
CREATE INDEX "SecretAccessLog_createdAt_idx" ON "SecretAccessLog"("createdAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeEmployeeId_fkey" FOREIGN KEY ("assigneeEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityAssignment" ADD CONSTRAINT "ResponsibilityAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResponsibilityInstruction" ADD CONSTRAINT "ResponsibilityInstruction_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityInstruction" ADD CONSTRAINT "ResponsibilityInstruction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityInstruction" ADD CONSTRAINT "ResponsibilityInstruction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResponsibilityChecklistItem" ADD CONSTRAINT "ResponsibilityChecklistItem_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretVaultItem" ADD CONSTRAINT "SecretVaultItem_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecretVaultItem" ADD CONSTRAINT "SecretVaultItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecretVaultItem" ADD CONSTRAINT "SecretVaultItem_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecretVaultItem" ADD CONSTRAINT "SecretVaultItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecretVaultItem" ADD CONSTRAINT "SecretVaultItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecretAccessLog" ADD CONSTRAINT "SecretAccessLog_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "SecretVaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretAccessLog" ADD CONSTRAINT "SecretAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
