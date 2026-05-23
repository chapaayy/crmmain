import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, BagBottomType, BagTopType, BagType, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { ImportProductsCsvDto } from "./dto/product-csv.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { CreateProductCategoryDto, UpdateProductCategoryDto } from "./dto/product-category.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { CreateProductVariantDto, UpdateProductVariantDto } from "./dto/product-variant.dto";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProductCategorySelect;

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  name: true,
  categoryId: true,
  description: true,
  size: true,
  density: true,
  color: true,
  material: true,
  bagType: true,
  weight: true,
  capacity: true,
  hasLiner: true,
  hasHandles: true,
  topType: true,
  bottomType: true,
  minOrderQty: true,
  packageQty: true,
  purchasePrice: true,
  retailPrice: true,
  wholesalePrice: true,
  isCustomOrderAvailable: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySelect
  }
} satisfies Prisma.ProductVariantSelect;

const productListSelect = {
  id: true,
  sku: true,
  name: true,
  categoryId: true,
  description: true,
  size: true,
  density: true,
  color: true,
  material: true,
  bagType: true,
  weight: true,
  capacity: true,
  hasLiner: true,
  hasHandles: true,
  topType: true,
  bottomType: true,
  minOrderQty: true,
  packageQty: true,
  purchasePrice: true,
  retailPrice: true,
  wholesalePrice: true,
  isCustomOrderAvailable: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySelect
  },
  variants: {
    where: { deletedAt: null, isActive: true },
    select: variantSelect,
    orderBy: { createdAt: "desc" }
  },
  _count: {
    select: {
      variants: true
    }
  }
} satisfies Prisma.ProductSelect;

const productDetailSelect = {
  ...productListSelect,
  variants: {
    where: { deletedAt: null },
    select: variantSelect,
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.ProductSelect;

type ProductPayload = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;
type ProductVariantPayload = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

const csvColumns = [
  "sku",
  "name",
  "category",
  "categorySlug",
  "categoryId",
  "description",
  "size",
  "density",
  "color",
  "material",
  "bagType",
  "weight",
  "capacity",
  "hasLiner",
  "hasHandles",
  "topType",
  "bottomType",
  "minOrderQty",
  "packageQty",
  "purchasePrice",
  "retailPrice",
  "wholesalePrice",
  "isCustomOrderAvailable",
  "isActive"
] as const;

type CsvRow = Record<string, string>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listCategories() {
    const categories = await this.prisma.productCategory.findMany({
      where: { deletedAt: null },
      select: {
        ...categorySelect,
        parent: {
          select: categorySelect
        },
        _count: {
          select: {
            products: true,
            variants: true
          }
        }
      },
      orderBy: [{ name: "asc" }]
    });

    return { categories };
  }

  async createCategory(dto: CreateProductCategoryDto, actorId: string) {
    const slug = normalizeSlug(dto.slug ?? dto.name);

    if (!slug) {
      throw new BadRequestException("Category slug is required");
    }

    if (dto.parentId) {
      await this.requireCategory(dto.parentId);
    }

    const category = await this.prisma.productCategory
      .create({
        data: {
          name: requiredString(dto.name, "Category name"),
          slug,
          description: nullableString(dto.description),
          parentId: dto.parentId,
          createdById: actorId,
          updatedById: actorId
        },
        select: categorySelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product category slug already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "ProductCategory",
      entityId: category.id,
      after: sanitizeJson(category)
    });

    return { category };
  }

  async updateCategory(id: string, dto: UpdateProductCategoryDto, actorId: string) {
    const before = await this.requireCategory(id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("Category cannot be its own parent");
      }

      await this.requireCategory(dto.parentId);
    }

    const category = await this.prisma.productCategory
      .update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: requiredString(dto.name, "Category name") } : {}),
          ...(dto.slug !== undefined ? { slug: requiredSlug(dto.slug) } : {}),
          ...(dto.description !== undefined ? { description: nullableString(dto.description) } : {}),
          ...(dto.parentId !== undefined ? { parentId: nullableString(dto.parentId) } : {}),
          updatedById: actorId
        },
        select: categorySelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product category slug already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ProductCategory",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(category)
    });

    return { category };
  }

  async deleteCategory(id: string, actorId: string) {
    const before = await this.requireCategory(id);
    const [products, variants] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
      this.prisma.productVariant.count({ where: { categoryId: id, deletedAt: null } })
    ]);

    if (products > 0 || variants > 0) {
      throw new BadRequestException("Category has active products or variants");
    }

    await this.prisma.productCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: actorId
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "ProductCategory",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async listProducts(query: ProductQueryDto) {
    const where = this.buildProductWhere(query);
    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: products,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async createProduct(dto: CreateProductDto, actorId: string) {
    await this.requireCategory(dto.categoryId);

    const product = await this.prisma.product
      .create({
        data: this.toProductCreateData(dto, actorId),
        select: productDetailSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product SKU already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "Product",
      entityId: product.id,
      after: sanitizeJson(product)
    });

    return { product };
  }

  async getProduct(id: string) {
    return { product: await this.requireProduct(id) };
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorId: string) {
    const before = await this.requireProduct(id);

    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId);
    }

    const product = await this.prisma.product
      .update({
        where: { id },
        data: this.toProductUpdateData(dto, actorId),
        select: productDetailSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product SKU already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Product",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(product)
    });

    return { product };
  }

  async deleteProduct(id: string, actorId: string) {
    const before = await this.requireProduct(id);

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          updatedById: actorId
        }
      }),
      this.prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          isActive: false,
          updatedById: actorId
        }
      })
    ]);

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "Product",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async createVariant(productId: string, dto: CreateProductVariantDto, actorId: string) {
    const product = await this.requireProduct(productId);
    const categoryId = dto.categoryId ?? product.categoryId;

    await this.requireCategory(categoryId);

    const variant = await this.prisma.productVariant
      .create({
        data: this.toVariantCreateData(product, dto, categoryId, actorId),
        select: variantSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product variant SKU already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "ProductVariant",
      entityId: variant.id,
      after: sanitizeJson(variant)
    });

    return { variant };
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto, actorId: string) {
    await this.requireProduct(productId);
    const before = await this.requireVariant(productId, variantId);

    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId);
    }

    const variant = await this.prisma.productVariant
      .update({
        where: { id: variantId },
        data: this.toVariantUpdateData(dto, actorId),
        select: variantSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Product variant SKU already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ProductVariant",
      entityId: variantId,
      before: sanitizeJson(before),
      after: sanitizeJson(variant)
    });

    return { variant };
  }

  async deleteVariant(productId: string, variantId: string, actorId: string) {
    await this.requireProduct(productId);
    const before = await this.requireVariant(productId, variantId);

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: actorId
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "ProductVariant",
      entityId: variantId,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async importCsv(dto: ImportProductsCsvDto, actorId: string) {
    const rows = parseCsv(dto.csv);

    if (rows.length === 0) {
      throw new BadRequestException("CSV is empty");
    }

    const summary = {
      rows: rows.length,
      created: 0,
      updated: 0,
      restored: 0,
      failed: 0
    };
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      try {
        const categoryId = await this.resolveCsvCategory(row, actorId);
        const createData = this.csvRowToProductCreateData(row, categoryId, actorId);
        const existing = await this.prisma.product.findUnique({ where: { sku: createData.sku } });

        if (!existing) {
          await this.prisma.product.create({ data: createData });
          summary.created += 1;
          continue;
        }

        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            ...createData,
            createdById: existing.createdById,
            updatedById: actorId,
            deletedAt: null
          }
        });

        if (existing.deletedAt) {
          summary.restored += 1;
        } else {
          summary.updated += 1;
        }
      } catch (error) {
        summary.failed += 1;
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed"}`);
      }
    }

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "ProductsCsvImport",
      after: sanitizeJson({ summary, errors })
    });

    return { summary, errors };
  }

  async exportCsv(query: ProductQueryDto, actorId: string) {
    const products = await this.prisma.product.findMany({
      where: this.buildProductWhere(query),
      select: productListSelect,
      orderBy: { createdAt: "desc" },
      take: 10000
    });
    const rows = products.map((product) => [
      product.sku,
      product.name,
      product.category.name,
      product.category.slug,
      product.categoryId,
      product.description,
      product.size,
      product.density,
      product.color,
      product.material,
      product.bagType,
      product.weight,
      product.capacity,
      product.hasLiner,
      product.hasHandles,
      product.topType,
      product.bottomType,
      product.minOrderQty,
      product.packageQty,
      product.purchasePrice,
      product.retailPrice,
      product.wholesalePrice,
      product.isCustomOrderAvailable,
      product.isActive
    ]);

    await this.auditService.log({
      actorId,
      action: AuditAction.EXPORT,
      entityType: "ProductsCsvExport",
      after: sanitizeJson({ rows: products.length, filters: query })
    });

    return [csvColumns.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
  }

  private buildProductWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    return {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.color ? { color: { contains: query.color, mode: "insensitive" } } : {}),
      ...(query.density ? { density: { contains: query.density, mode: "insensitive" } } : {}),
      ...(query.size ? { size: { contains: query.size, mode: "insensitive" } } : {}),
      ...(query.hasLiner !== undefined ? { hasLiner: query.hasLiner } : {}),
      ...(query.hasHandles !== undefined ? { hasHandles: query.hasHandles } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isCustomOrderAvailable !== undefined ? { isCustomOrderAvailable: query.isCustomOrderAvailable } : {}),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { size: { contains: query.search, mode: "insensitive" } },
              { density: { contains: query.search, mode: "insensitive" } },
              { color: { contains: query.search, mode: "insensitive" } },
              { material: { contains: query.search, mode: "insensitive" } },
              { category: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, deletedAt: null },
      select: categorySelect
    });

    if (!category) {
      throw new NotFoundException("Product category not found");
    }

    return category;
  }

  private async requireProduct(id: string): Promise<ProductPayload> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: productDetailSelect
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  private async requireVariant(productId: string, variantId: string): Promise<ProductVariantPayload> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
      select: variantSelect
    });

    if (!variant) {
      throw new NotFoundException("Product variant not found");
    }

    return variant;
  }

  private toProductCreateData(dto: CreateProductDto, actorId: string): Prisma.ProductUncheckedCreateInput {
    return {
      sku: requiredString(dto.sku, "Product SKU"),
      name: requiredString(dto.name, "Product name"),
      categoryId: dto.categoryId,
      description: nullableString(dto.description),
      size: nullableString(dto.size),
      density: nullableString(dto.density),
      color: nullableString(dto.color),
      material: nullableString(dto.material) ?? "polypropylene",
      bagType: dto.bagType ?? BagType.POLYPROPYLENE_BAG,
      weight: decimalOrUndefined(dto.weight),
      capacity: nullableString(dto.capacity),
      hasLiner: dto.hasLiner ?? false,
      hasHandles: dto.hasHandles ?? false,
      topType: dto.topType,
      bottomType: dto.bottomType,
      minOrderQty: dto.minOrderQty ?? 1,
      packageQty: dto.packageQty,
      purchasePrice: decimalOrUndefined(dto.purchasePrice),
      retailPrice: decimalOrUndefined(dto.retailPrice),
      wholesalePrice: decimalOrUndefined(dto.wholesalePrice),
      isCustomOrderAvailable: dto.isCustomOrderAvailable ?? false,
      isActive: dto.isActive ?? true,
      createdById: actorId,
      updatedById: actorId
    };
  }

  private toProductUpdateData(dto: UpdateProductDto, actorId: string): Prisma.ProductUncheckedUpdateInput {
    const data: Prisma.ProductUncheckedUpdateInput = {
      updatedById: actorId
    };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "sku", dto.sku, (value) => requiredString(value, "Product SKU"));
    assignIfDefined(writable, "name", dto.name, (value) => requiredString(value, "Product name"));
    assignIfDefined(writable, "categoryId", dto.categoryId);
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "size", dto.size, nullableString);
    assignIfDefined(writable, "density", dto.density, nullableString);
    assignIfDefined(writable, "color", dto.color, nullableString);
    assignIfDefined(writable, "material", dto.material, (value) => nullableString(value) ?? "polypropylene");
    assignIfDefined(writable, "bagType", dto.bagType);
    assignIfDefined(writable, "weight", dto.weight, decimalOrNull);
    assignIfDefined(writable, "capacity", dto.capacity, nullableString);
    assignIfDefined(writable, "hasLiner", dto.hasLiner);
    assignIfDefined(writable, "hasHandles", dto.hasHandles);
    assignIfDefined(writable, "topType", dto.topType);
    assignIfDefined(writable, "bottomType", dto.bottomType);
    assignIfDefined(writable, "minOrderQty", dto.minOrderQty);
    assignIfDefined(writable, "packageQty", dto.packageQty);
    assignIfDefined(writable, "purchasePrice", dto.purchasePrice, decimalOrNull);
    assignIfDefined(writable, "retailPrice", dto.retailPrice, decimalOrNull);
    assignIfDefined(writable, "wholesalePrice", dto.wholesalePrice, decimalOrNull);
    assignIfDefined(writable, "isCustomOrderAvailable", dto.isCustomOrderAvailable);
    assignIfDefined(writable, "isActive", dto.isActive);

    return data;
  }

  private toVariantCreateData(
    product: ProductPayload,
    dto: CreateProductVariantDto,
    categoryId: string,
    actorId: string
  ): Prisma.ProductVariantUncheckedCreateInput {
    return {
      productId: product.id,
      sku: requiredString(dto.sku, "Variant SKU"),
      name: requiredString(dto.name, "Variant name"),
      categoryId,
      description: nullableString(dto.description) ?? product.description,
      size: nullableString(dto.size) ?? product.size,
      density: nullableString(dto.density) ?? product.density,
      color: nullableString(dto.color) ?? product.color,
      material: nullableString(dto.material) ?? product.material,
      bagType: dto.bagType ?? product.bagType,
      weight: decimalOrUndefined(dto.weight) ?? product.weight,
      capacity: nullableString(dto.capacity) ?? product.capacity,
      hasLiner: dto.hasLiner ?? product.hasLiner,
      hasHandles: dto.hasHandles ?? product.hasHandles,
      topType: dto.topType ?? product.topType,
      bottomType: dto.bottomType ?? product.bottomType,
      minOrderQty: dto.minOrderQty ?? product.minOrderQty,
      packageQty: dto.packageQty ?? product.packageQty,
      purchasePrice: decimalOrUndefined(dto.purchasePrice) ?? product.purchasePrice,
      retailPrice: decimalOrUndefined(dto.retailPrice) ?? product.retailPrice,
      wholesalePrice: decimalOrUndefined(dto.wholesalePrice) ?? product.wholesalePrice,
      isCustomOrderAvailable: dto.isCustomOrderAvailable ?? product.isCustomOrderAvailable,
      isActive: dto.isActive ?? product.isActive,
      createdById: actorId,
      updatedById: actorId
    };
  }

  private toVariantUpdateData(dto: UpdateProductVariantDto, actorId: string): Prisma.ProductVariantUncheckedUpdateInput {
    const data: Prisma.ProductVariantUncheckedUpdateInput = {
      updatedById: actorId
    };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "sku", dto.sku, (value) => requiredString(value, "Variant SKU"));
    assignIfDefined(writable, "name", dto.name, (value) => requiredString(value, "Variant name"));
    assignIfDefined(writable, "categoryId", dto.categoryId);
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "size", dto.size, nullableString);
    assignIfDefined(writable, "density", dto.density, nullableString);
    assignIfDefined(writable, "color", dto.color, nullableString);
    assignIfDefined(writable, "material", dto.material, (value) => nullableString(value) ?? "polypropylene");
    assignIfDefined(writable, "bagType", dto.bagType);
    assignIfDefined(writable, "weight", dto.weight, decimalOrNull);
    assignIfDefined(writable, "capacity", dto.capacity, nullableString);
    assignIfDefined(writable, "hasLiner", dto.hasLiner);
    assignIfDefined(writable, "hasHandles", dto.hasHandles);
    assignIfDefined(writable, "topType", dto.topType);
    assignIfDefined(writable, "bottomType", dto.bottomType);
    assignIfDefined(writable, "minOrderQty", dto.minOrderQty);
    assignIfDefined(writable, "packageQty", dto.packageQty);
    assignIfDefined(writable, "purchasePrice", dto.purchasePrice, decimalOrNull);
    assignIfDefined(writable, "retailPrice", dto.retailPrice, decimalOrNull);
    assignIfDefined(writable, "wholesalePrice", dto.wholesalePrice, decimalOrNull);
    assignIfDefined(writable, "isCustomOrderAvailable", dto.isCustomOrderAvailable);
    assignIfDefined(writable, "isActive", dto.isActive);

    return data;
  }

  private async resolveCsvCategory(row: CsvRow, actorId: string) {
    const categoryId = nullableString(row.categoryId);

    if (categoryId) {
      await this.requireCategory(categoryId);
      return categoryId;
    }

    const categoryName = nullableString(row.category);
    const categorySlug = normalizeSlug(row.categorySlug ?? categoryName);

    if (!categoryName && !categorySlug) {
      throw new BadRequestException("Category, categorySlug, or categoryId is required");
    }

    const existing = await this.prisma.productCategory.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(categorySlug ? [{ slug: categorySlug }] : []),
          ...(categoryName ? [{ name: { equals: categoryName, mode: "insensitive" as const } }] : [])
        ]
      },
      select: { id: true }
    });

    if (existing) {
      return existing.id;
    }

    if (!categoryName || !categorySlug) {
      throw new BadRequestException("Unknown category");
    }

    const category = await this.prisma.productCategory.create({
      data: {
        name: categoryName,
        slug: categorySlug,
        createdById: actorId,
        updatedById: actorId
      },
      select: { id: true }
    });

    return category.id;
  }

  private csvRowToProductCreateData(row: CsvRow, categoryId: string, actorId: string): Prisma.ProductUncheckedCreateInput {
    const sku = requiredString(row.sku, "Product SKU");
    const name = requiredString(row.name, "Product name");

    return {
      sku,
      name,
      categoryId,
      description: nullableString(row.description),
      size: nullableString(row.size),
      density: nullableString(row.density),
      color: nullableString(row.color),
      material: nullableString(row.material) ?? "polypropylene",
      bagType: parseEnum(row.bagType, BagType, BagType.POLYPROPYLENE_BAG),
      weight: decimalOrUndefined(parseOptionalNumber(row.weight, "weight")),
      capacity: nullableString(row.capacity),
      hasLiner: parseOptionalBoolean(row.hasLiner) ?? false,
      hasHandles: parseOptionalBoolean(row.hasHandles) ?? false,
      topType: parseEnum(row.topType, BagTopType),
      bottomType: parseEnum(row.bottomType, BagBottomType),
      minOrderQty: parseOptionalInt(row.minOrderQty, "minOrderQty") ?? 1,
      packageQty: parseOptionalInt(row.packageQty, "packageQty"),
      purchasePrice: decimalOrUndefined(parseOptionalNumber(row.purchasePrice, "purchasePrice")),
      retailPrice: decimalOrUndefined(parseOptionalNumber(row.retailPrice, "retailPrice")),
      wholesalePrice: decimalOrUndefined(parseOptionalNumber(row.wholesalePrice, "wholesalePrice")),
      isCustomOrderAvailable: parseOptionalBoolean(row.isCustomOrderAvailable) ?? false,
      isActive: parseOptionalBoolean(row.isActive) ?? true,
      createdById: actorId,
      updatedById: actorId
    };
  }
}

function assignIfDefined<V>(
  target: Record<string, unknown>,
  key: string,
  value: V | undefined,
  mapper?: (value: V) => unknown
) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function requiredString(value: string | undefined, field: string) {
  const normalized = nullableString(value);

  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }

  return normalized;
}

function nullableString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeSlug(value: string | null | undefined) {
  const normalized = nullableString(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function requiredSlug(value: string | undefined) {
  const slug = normalizeSlug(value);

  if (!slug) {
    throw new BadRequestException("Category slug is required");
  }

  return slug;
}

function decimalOrUndefined(value: number | string | Prisma.Decimal | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return new Prisma.Decimal(value);
}

function decimalOrNull(value: number | string | Prisma.Decimal | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return new Prisma.Decimal(value);
}

function parseOptionalNumber(value: string | undefined, field: string) {
  const normalized = nullableString(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized.replace(",", "."));

  if (Number.isNaN(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }

  return parsed;
}

function parseOptionalInt(value: string | undefined, field: string) {
  const parsed = parseOptionalNumber(value, field);

  if (parsed === undefined) {
    return undefined;
  }

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be an integer greater than zero`);
  }

  return parsed;
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = nullableString(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new BadRequestException(`Invalid boolean value: ${value}`);
}

function parseEnum<T extends Record<string, string>>(value: string | undefined, enumObject: T, fallback?: T[keyof T]) {
  const normalized = nullableString(value);

  if (!normalized) {
    return fallback;
  }

  if (Object.values(enumObject).includes(normalized)) {
    return normalized as T[keyof T];
  }

  throw new BadRequestException(`Invalid enum value: ${normalized}`);
}

function parseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);

    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

function detectDelimiter(header: string) {
  return header.split(";").length > header.split(",").length ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function csvEscape(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}
