export interface Permission {
  id: string;
  key: string;
  name: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  color?: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  locale?: string | null;
  role?: string;
  primaryRole?: string;
  isActive?: boolean;
  roles?: Role[];
  permissions?: Permission[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: CurrentUser;
}

export interface ApiErrorBody {
  success?: false;
  error?: {
    statusCode?: number;
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
}
