import type { PaginationMeta, UserSummary } from "@/components/customers/crm-types";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskRelatedType = "CUSTOMER" | "LEAD" | "ORDER" | "PRODUCT";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  relatedType?: TaskRelatedType | null;
  relatedId?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  assignedTo?: UserSummary | null;
  createdBy?: UserSummary | null;
  customer?: {
    id: string;
    name: string;
    companyName?: string | null;
  } | null;
  lead?: {
    id: string;
    title?: string | null;
    name?: string | null;
  } | null;
  order?: {
    id: string;
    number: string;
  } | null;
  product?: {
    id: string;
    sku: string;
    name: string;
  } | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  data: Task[];
  meta: PaginationMeta;
}

export interface TaskResponse {
  task: Task;
}
