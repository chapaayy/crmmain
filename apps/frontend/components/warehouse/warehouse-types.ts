import type { PaginationMeta } from "@/components/admin/admin-types";
import type { Product, ProductVariant } from "@/components/products/product-types";
import type { Order } from "@/components/orders/order-types";
import type { UserSummary } from "@/components/customers/crm-types";

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  managerId?: string | null;
  manager?: UserSummary | null;
  _count?: {
    stockItems: number;
    orders: number;
  };
}

export interface WarehousesResponse {
  warehouses: Warehouse[];
}

export interface StockItem {
  id: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantity: string | number;
  reservedQuantity: string | number;
  available: number;
  unit: string;
  warehouse: Pick<Warehouse, "id" | "code" | "name">;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  variant?: {
    id: string;
    sku: string;
    name: string;
  } | null;
  updatedAt: string;
}

export type StockMovementType =
  | "RECEIPT"
  | "SALE"
  | "RESERVATION"
  | "RELEASE_RESERVATION"
  | "SHIPMENT"
  | "RETURN"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "WRITEOFF";

export interface StockMovement {
  id: string;
  type: StockMovementType;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  orderId?: string | null;
  quantity: string | number;
  unit: string;
  balanceBefore?: string | number | null;
  balanceAfter?: string | number | null;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  warehouse: Pick<Warehouse, "id" | "code" | "name">;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  variant?: {
    id: string;
    sku: string;
    name: string;
  } | null;
  order?: {
    id: string;
    number: string;
    status: string;
  } | null;
}

export interface ProductsResponse {
  data: Product[];
}

export interface OrdersResponse {
  data: Order[];
}

export type { ProductVariant };
