export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: AdminPermission[];
}

export interface AdminPermission {
  id: string;
  key: string;
  name: string;
  resource: string;
  action: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  locale?: string | null;
  primaryRole: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  roles?: AdminRole[];
}

export interface SettingsPayload {
  companyProfile: Record<string, string>;
  requisites: Record<string, string>;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: {
    id: string;
    email: string;
    name: string;
  } | null;
  createdAt: string;
}
