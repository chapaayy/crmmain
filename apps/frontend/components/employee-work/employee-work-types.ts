import type { PaginatedResponse } from "@/components/admin/admin-types";
import type { Employee, UserOption } from "@/components/hr/hr-types";

export type { Employee, PaginatedResponse, UserOption };

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ResponsibilityStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type ResponsibilityAssignmentRole = "OWNER" | "BACKUP" | "PARTICIPANT" | "VIEWER";
export type SecretVaultItemType = "LOGIN_PASSWORD" | "API_KEY" | "TOKEN" | "CARD_INFO" | "EMAIL_ACCOUNT" | "TELEGRAM_ACCOUNT" | "HOSTING" | "OTHER";

export interface EmployeeTask {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  completedAt?: string | null;
  assignedToId?: string | null;
  assigneeUserId?: string | null;
  assigneeEmployeeId?: string | null;
  assigneeDepartment?: string | null;
  responsibilityId?: string | null;
  assignedTo?: UserOption | null;
  assigneeEmployee?: Employee | null;
  responsibility?: ResponsibilitySummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResponsibilitySummary {
  id: string;
  title: string;
  category?: string | null;
  status: ResponsibilityStatus;
}

export interface Responsibility extends ResponsibilitySummary {
  description?: string | null;
  ownerUserId?: string | null;
  ownerEmployeeId?: string | null;
  ownerUser?: UserOption | null;
  ownerEmployee?: Employee | null;
  createdBy?: UserOption | null;
  assignments?: ResponsibilityAssignment[];
  instructions?: ResponsibilityInstruction[];
  checklistItems?: ResponsibilityChecklistItem[];
  tasks?: EmployeeTask[];
  secrets?: SecretVaultItem[];
  _count?: {
    assignments?: number;
    instructions?: number;
    checklistItems?: number;
    tasks?: number;
    secrets?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ResponsibilityAssignment {
  id: string;
  responsibilityId: string;
  employeeId?: string | null;
  userId?: string | null;
  role: ResponsibilityAssignmentRole;
  employee?: Employee | null;
  user?: UserOption | null;
  assignedBy?: UserOption | null;
  assignedAt: string;
}

export interface ResponsibilityInstruction {
  id: string;
  responsibilityId: string;
  title: string;
  content: string;
  format: "MARKDOWN" | "PLAIN_TEXT";
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResponsibilityChecklistItem {
  id: string;
  responsibilityId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  isRequired: boolean;
}

export interface SecretVaultItem {
  id: string;
  title: string;
  description?: string | null;
  type: SecretVaultItemType;
  url?: string | null;
  username?: string | null;
  login?: string | null;
  phone?: string | null;
  email?: string | null;
  responsibilityId?: string | null;
  ownerUserId?: string | null;
  ownerEmployeeId?: string | null;
  responsibility?: ResponsibilitySummary | null;
  ownerUser?: UserOption | null;
  ownerEmployee?: Employee | null;
  hasSecret?: boolean;
  hasNotes?: boolean;
  secretMasked?: string | null;
  notesMasked?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecretRevealResponse {
  id: string;
  title: string;
  secret: string | null;
  notes: string | null;
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  userId: string;
  action: string;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: UserOption;
}
