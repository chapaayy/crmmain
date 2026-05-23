import type { Customer, TimelineItem, UserSummary } from "@/components/customers/crm-types";
import type { Product } from "@/components/products/product-types";

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

export type OrderStatus =
  | "DRAFT"
  | "NEW"
  | "MANAGER_PROCESSING"
  | "WAITING_PAYMENT"
  | "PAID"
  | "RESERVED"
  | "PICKING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type DiscountType = "NONE" | "PERCENT" | "FIXED";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID" | "REFUNDED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "ONLINE" | "OTHER";
export type DocumentType = "INVOICE" | "COMMERCIAL_OFFER" | "DELIVERY_NOTE" | "ACT" | "CONTRACT";

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string | null;
  sku: string;
  name: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
  notes?: string | null;
  variant?: {
    id: string;
    sku: string;
    name: string;
    productId: string;
    retailPrice?: string | number | null;
    wholesalePrice?: string | number | null;
  } | null;
}

export interface OrderStatusHistory {
  id: string;
  previousStatus?: OrderStatus | null;
  status: OrderStatus;
  comment?: string | null;
  createdAt: string;
  changedBy?: UserSummary | null;
}

export interface OrderComment {
  id: string;
  body: string;
  createdAt: string;
  author?: UserSummary | null;
}

export interface OrderCustomer {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  inn?: string | null;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customerId: string;
  contactId?: string | null;
  leadId?: string | null;
  managerId?: string | null;
  warehouseId?: string | null;
  currency: string;
  subtotal: string | number;
  discountType: DiscountType;
  discountValue: string | number;
  discount: string | number;
  taxRate: string | number;
  tax: string | number;
  total: string | number;
  paidAmount: string | number;
  paymentStatus: PaymentStatus;
  dueDate?: string | null;
  notes?: string | null;
  customer: OrderCustomer;
  manager?: UserSummary | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  comments?: OrderComment[];
  events?: TimelineItem[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
    comments: number;
    payments: number;
    documents: number;
  };
}

export interface OrderResponse {
  order: Order;
}

export interface StatusHistoryResponse {
  history: OrderStatusHistory[];
}

export interface Payment {
  id: string;
  orderId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: string | number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  externalId?: string | null;
  note?: string | null;
  order?: {
    id: string;
    number: string;
    total: string | number;
    paidAmount: string | number;
    paymentStatus: PaymentStatus;
    currency: string;
    customer?: OrderCustomer | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFileAsset {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string | null;
}

export interface Document {
  id: string;
  type: DocumentType;
  number?: string | null;
  title: string;
  status?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  fileAsset?: DocumentFileAsset | null;
  order?: {
    id: string;
    number: string;
    total: string | number;
    currency: string;
    paymentStatus: PaymentStatus;
    customer?: OrderCustomer | null;
  } | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentsResponse {
  payments: Payment[];
}

export interface DocumentsResponse {
  data: Document[];
}

export interface ProductsResponse {
  data: Product[];
}

export interface CustomersResponse {
  data: Customer[];
}
