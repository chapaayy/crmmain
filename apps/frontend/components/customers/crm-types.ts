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

export interface UserSummary {
  id: string;
  email: string;
  name: string;
}

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  author?: UserSummary;
}

export interface TimelineItem {
  id: string;
  kind?: "event" | "comment";
  type: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  createdAt: string;
  actor?: UserSummary | null;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  notes?: string | null;
}

export interface Customer {
  id: string;
  code?: string | null;
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  deliveryAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  messengers?: string[];
  source?: string | null;
  segment?: string | null;
  notes?: string | null;
  status: string;
  responsibleManagerId?: string | null;
  responsibleManager?: UserSummary | null;
  contacts?: CustomerContact[];
  comments?: CommentItem[];
  events?: TimelineItem[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    contacts: number;
    orders: number;
    comments: number;
  };
}

export interface Lead {
  id: string;
  number: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status: string;
  interestedProducts?: string[];
  responsibleManagerId?: string | null;
  responsibleManager?: UserSummary | null;
  nextContactAt?: string | null;
  convertedAt?: string | null;
  customerId?: string | null;
  comment?: string | null;
  estimatedValue?: string | number | null;
  comments?: CommentItem[];
  events?: TimelineItem[];
  customer?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerResponse {
  customer: Customer;
}

export interface LeadResponse {
  lead: Lead;
}

export interface TimelineResponse {
  timeline: TimelineItem[];
}
