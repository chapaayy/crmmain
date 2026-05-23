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

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  parent?: ProductCategory | null;
  _count?: {
    products: number;
    variants: number;
  };
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  categoryId: string;
  description?: string | null;
  size?: string | null;
  density?: string | null;
  color?: string | null;
  material: string;
  bagType: string;
  weight?: string | number | null;
  capacity?: string | null;
  hasLiner: boolean;
  hasHandles: boolean;
  topType?: string | null;
  bottomType?: string | null;
  minOrderQty: number;
  packageQty?: number | null;
  purchasePrice?: string | number | null;
  retailPrice?: string | number | null;
  wholesalePrice?: string | number | null;
  isCustomOrderAvailable: boolean;
  isActive: boolean;
  category?: ProductCategory;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product extends Omit<ProductVariant, "id" | "productId"> {
  id: string;
  category: ProductCategory;
  variants?: ProductVariant[];
  _count?: {
    variants: number;
  };
}

export interface ProductFormState {
  sku: string;
  name: string;
  categoryId: string;
  description: string;
  size: string;
  density: string;
  color: string;
  material: string;
  bagType: string;
  weight: string;
  capacity: string;
  hasLiner: boolean;
  hasHandles: boolean;
  topType: string;
  bottomType: string;
  minOrderQty: string;
  packageQty: string;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  isCustomOrderAvailable: boolean;
  isActive: boolean;
}

export interface CategoriesResponse {
  categories: ProductCategory[];
}

export interface ProductResponse {
  product: Product;
}

export interface VariantResponse {
  variant: ProductVariant;
}
