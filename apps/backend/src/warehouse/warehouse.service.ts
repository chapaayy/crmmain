import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationType, Prisma, StockMovementType } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { StockAdjustDto, StockReceiptDto, StockWriteoffDto } from "./dto/stock-operation.dto";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";
import { StockMovementQueryDto, StockQueryDto } from "./dto/warehouse-query.dto";

const managerSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const productSelect = {
  id: true,
  sku: true,
  name: true,
  minOrderQty: true
} satisfies Prisma.ProductSelect;

const variantSelect = {
  id: true,
  sku: true,
  name: true,
  productId: true,
  product: {
    select: productSelect
  }
} satisfies Prisma.ProductVariantSelect;

const warehouseSelect = {
  id: true,
  code: true,
  name: true,
  address: true,
  isActive: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: managerSelect
  },
  _count: {
    select: {
      stockItems: true
    }
  }
} satisfies Prisma.WarehouseSelect;

const stockItemSelect = {
  id: true,
  warehouseId: true,
  productId: true,
  variantId: true,
  quantity: true,
  reservedQuantity: true,
  unit: true,
  createdAt: true,
  updatedAt: true,
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true
    }
  },
  product: {
    select: productSelect
  },
  variant: {
    select: variantSelect
  }
} satisfies Prisma.StockItemSelect;

const movementSelect = {
  id: true,
  type: true,
  warehouseId: true,
  fromWarehouseId: true,
  toWarehouseId: true,
  stockItemId: true,
  productId: true,
  variantId: true,
  quantity: true,
  unit: true,
  balanceBefore: true,
  balanceAfter: true,
  reference: true,
  note: true,
  createdAt: true,
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true
    }
  },
  product: {
    select: productSelect
  },
  variant: {
    select: variantSelect
  },
  createdBy: {
    select: managerSelect
  }
} satisfies Prisma.StockMovementSelect;

type WarehousePayload = Prisma.WarehouseGetPayload<{ select: typeof warehouseSelect }>;
type StockItemPayload = Prisma.StockItemGetPayload<{ select: typeof stockItemSelect }>;
type VariantPayload = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async listWarehouses() {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { deletedAt: null },
      select: warehouseSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    return { warehouses: warehouses.map((warehouse) => this.serializeWarehouse(warehouse)) };
  }

  async createWarehouse(dto: CreateWarehouseDto, actorId: string) {
    await this.ensureManagerExists(dto.managerId);

    const warehouse = await this.prisma.warehouse
      .create({
        data: {
          code: requiredString(dto.code, "Warehouse code").toUpperCase(),
          name: requiredString(dto.name, "Warehouse name"),
          address: nullableString(dto.address),
          managerId: nullableString(dto.managerId),
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId
        },
        select: warehouseSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Warehouse code already exists");
        }

        throw error;
      });

    await this.audit(this.prisma, actorId, AuditAction.CREATE, "Warehouse", warehouse.id, undefined, warehouse);

    return { warehouse: this.serializeWarehouse(warehouse) };
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, actorId: string) {
    const before = await this.requireWarehouse(this.prisma, id);

    await this.ensureManagerExists(dto.managerId);

    const warehouse = await this.prisma.warehouse
      .update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: requiredString(dto.code, "Warehouse code").toUpperCase() } : {}),
          ...(dto.name !== undefined ? { name: requiredString(dto.name, "Warehouse name") } : {}),
          ...(dto.address !== undefined ? { address: nullableString(dto.address) } : {}),
          ...(dto.managerId !== undefined ? { managerId: nullableString(dto.managerId) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedById: actorId
        },
        select: warehouseSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Warehouse code already exists");
        }

        throw error;
      });

    await this.audit(this.prisma, actorId, AuditAction.UPDATE, "Warehouse", id, before, warehouse);

    return { warehouse: this.serializeWarehouse(warehouse) };
  }

  async deleteWarehouse(id: string, actorId: string) {
    const before = await this.requireWarehouse(this.prisma, id);
    const blockingStock = await this.prisma.stockItem.findFirst({
      where: {
        warehouseId: id,
        deletedAt: null,
        OR: [{ quantity: { gt: 0 } }, { reservedQuantity: { gt: 0 } }]
      },
      select: { id: true }
    });

    if (blockingStock) {
      throw new BadRequestException("Warehouse has non-zero stock");
    }

    await this.prisma.warehouse.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: actorId
      }
    });

    await this.audit(this.prisma, actorId, AuditAction.DELETE, "Warehouse", id, before);

    return { success: true };
  }

  async stock(query: StockQueryDto) {
    const where = this.buildStockWhere(query);
    const [total, items] = await Promise.all([
      this.prisma.stockItem.count({ where }),
      this.prisma.stockItem.findMany({
        where,
        select: stockItemSelect,
        orderBy: { updatedAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: items.map((item) => this.serializeStockItem(item)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async movements(query: StockMovementQueryDto) {
    const where = this.buildMovementWhere(query);
    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        select: movementSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: movements,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async receipt(dto: StockReceiptDto, actorId: string) {
    const stockItem = await this.prisma.$transaction(async (tx) => {
      const item = await this.increaseQuantity(tx, dto.warehouseId, dto.productVariantId, dto.quantity, actorId, cleanUnit(dto.unit));

      await this.createMovement(tx, {
        type: StockMovementType.RECEIPT,
        stockItem: item,
        quantity: dto.quantity,
        actorId,
        reference: dto.reference,
        note: dto.note,
        balanceBefore: item.balanceBefore,
        balanceAfter: item.balanceAfter
      });
      await this.audit(tx, actorId, AuditAction.CREATE, "StockReceipt", item.stockItem.id, undefined, {
        warehouseId: dto.warehouseId,
        productVariantId: dto.productVariantId,
        quantity: dto.quantity
      });

      return item.stockItem;
    });

    this.publishLowStockForItems([stockItem]);

    return { stockItem: this.serializeStockItem(stockItem) };
  }

  async adjust(dto: StockAdjustDto, actorId: string) {
    if (dto.quantityDelta === 0) {
      throw new BadRequestException("Adjustment quantity cannot be zero");
    }

    const stockItem = await this.prisma.$transaction(async (tx) => {
      const item = await this.adjustQuantity(tx, dto.warehouseId, dto.productVariantId, dto.quantityDelta, actorId, cleanUnit(dto.unit));

      await this.createMovement(tx, {
        type: StockMovementType.ADJUSTMENT,
        stockItem: item,
        quantity: dto.quantityDelta,
        actorId,
        reference: dto.reference,
        note: dto.note,
        balanceBefore: item.balanceBefore,
        balanceAfter: item.balanceAfter
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "StockAdjustment", item.stockItem.id, undefined, {
        warehouseId: dto.warehouseId,
        productVariantId: dto.productVariantId,
        quantityDelta: dto.quantityDelta
      });

      return item.stockItem;
    });

    this.publishLowStockForItems([stockItem]);

    return { stockItem: this.serializeStockItem(stockItem) };
  }

  async writeoff(dto: StockWriteoffDto, actorId: string) {
    const stockItem = await this.prisma.$transaction(async (tx) => {
      const item = await this.decreaseQuantity(tx, dto.warehouseId, dto.productVariantId, dto.quantity, actorId, cleanUnit(dto.unit), true);

      await this.createMovement(tx, {
        type: StockMovementType.WRITEOFF,
        stockItem: item,
        quantity: dto.quantity,
        actorId,
        reference: dto.reference,
        note: dto.note,
        balanceBefore: item.balanceBefore,
        balanceAfter: item.balanceAfter
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "StockWriteoff", item.stockItem.id, undefined, {
        warehouseId: dto.warehouseId,
        productVariantId: dto.productVariantId,
        quantity: dto.quantity
      });

      return item.stockItem;
    });

    this.publishLowStockForItems([stockItem]);

    return { stockItem: this.serializeStockItem(stockItem) };
  }

  private buildStockWhere(query: StockQueryDto): Prisma.StockItemWhereInput {
    return {
      deletedAt: null,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.search
        ? {
            OR: [
              { product: { name: { contains: query.search, mode: "insensitive" } } },
              { product: { sku: { contains: query.search, mode: "insensitive" } } },
              { variant: { name: { contains: query.search, mode: "insensitive" } } },
              { variant: { sku: { contains: query.search, mode: "insensitive" } } },
              { warehouse: { name: { contains: query.search, mode: "insensitive" } } },
              { warehouse: { code: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private buildMovementWhere(query: StockMovementQueryDto): Prisma.StockMovementWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      createdAt.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      createdAt.lte = new Date(query.dateTo);
    }

    return {
      deletedAt: null,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
              { product: { name: { contains: query.search, mode: "insensitive" } } },
              { variant: { sku: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async increaseQuantity(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
    actorId: string,
    unit: string
  ) {
    const item = await this.getOrCreateStockItem(tx, warehouseId, productVariantId, actorId, unit);
    const before = decimalToNumber(item.quantity);
    const after = roundQuantity(before + quantity);
    const stockItem = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        quantity: quantityDecimal(after),
        unit,
        updatedById: actorId
      },
      select: stockItemSelect
    });

    return { stockItem, balanceBefore: before, balanceAfter: after };
  }

  private async adjustQuantity(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    quantityDelta: number,
    actorId: string,
    unit: string
  ) {
    const item = await this.getOrCreateStockItem(tx, warehouseId, productVariantId, actorId, unit);
    const before = decimalToNumber(item.quantity);
    const reserved = decimalToNumber(item.reservedQuantity);
    const after = roundQuantity(before + quantityDelta);

    if (after < 0) {
      throw new BadRequestException("Stock quantity cannot become negative");
    }

    if (after < reserved) {
      throw new BadRequestException("Physical quantity cannot be lower than reserved quantity");
    }

    const stockItem = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        quantity: quantityDecimal(after),
        unit,
        updatedById: actorId
      },
      select: stockItemSelect
    });

    return { stockItem, balanceBefore: before, balanceAfter: after };
  }

  private async decreaseQuantity(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
    actorId: string,
    unit: string,
    useAvailableOnly: boolean
  ) {
    const item = await this.getOrCreateStockItem(tx, warehouseId, productVariantId, actorId, unit);
    const before = decimalToNumber(item.quantity);
    const reserved = decimalToNumber(item.reservedQuantity);
    const available = before - reserved;

    if (quantity > (useAvailableOnly ? available : before)) {
      throw new BadRequestException(useAvailableOnly ? "Cannot write off more than available stock" : "Cannot reduce more than physical stock");
    }

    const after = roundQuantity(before - quantity);
    const stockItem = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        quantity: quantityDecimal(after),
        unit,
        updatedById: actorId
      },
      select: stockItemSelect
    });

    return { stockItem, balanceBefore: before, balanceAfter: after };
  }

  private async getOrCreateStockItem(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    actorId: string,
    unit: string
  ) {
    await this.requireWarehouse(tx, warehouseId, true);
    const variant = await this.requireVariant(tx, productVariantId);

    return tx.stockItem.upsert({
      where: {
        warehouseId_productId_variantId: {
          warehouseId,
          productId: variant.productId,
          variantId: variant.id
        }
      },
      update: {
        deletedAt: null,
        unit,
        updatedById: actorId
      },
      create: {
        warehouseId,
        productId: variant.productId,
        variantId: variant.id,
        quantity: quantityDecimal(0),
        reservedQuantity: quantityDecimal(0),
        unit,
        createdById: actorId,
        updatedById: actorId
      },
      select: stockItemSelect
    });
  }

  private async requireWarehouse(client: PrismaService | Prisma.TransactionClient, id: string, activeOnly = false): Promise<WarehousePayload> {
    const warehouse = await client.warehouse.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {})
      },
      select: warehouseSelect
    });

    if (!warehouse) {
      throw new NotFoundException(activeOnly ? "Warehouse not found or inactive" : "Warehouse not found");
    }

    return warehouse;
  }

  private async requireVariant(tx: Prisma.TransactionClient, id: string): Promise<VariantPayload> {
    const variant = await tx.productVariant.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
        product: {
          isActive: true,
          deletedAt: null
        }
      },
      select: variantSelect
    });

    if (!variant) {
      throw new NotFoundException("Product variant not found or inactive");
    }

    return variant;
  }

  private createMovement(
    tx: Prisma.TransactionClient,
    input: {
      type: StockMovementType;
      stockItem: { stockItem: StockItemPayload };
      quantity: number;
      actorId: string;
      reference?: string;
      note?: string;
      balanceBefore: number;
      balanceAfter: number;
    }
  ) {
    return tx.stockMovement.create({
      data: {
        type: input.type,
        warehouseId: input.stockItem.stockItem.warehouseId,
        stockItemId: input.stockItem.stockItem.id,
        productId: input.stockItem.stockItem.productId,
        variantId: input.stockItem.stockItem.variantId,
        quantity: quantityDecimal(input.quantity),
        unit: input.stockItem.stockItem.unit,
        balanceBefore: quantityDecimal(input.balanceBefore),
        balanceAfter: quantityDecimal(input.balanceAfter),
        reference: nullableString(input.reference),
        note: nullableString(input.note),
        createdById: input.actorId,
        updatedById: input.actorId
      }
    });
  }

  private async ensureManagerExists(managerId?: string) {
    if (!managerId) {
      return;
    }

    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, isActive: true, deletedAt: null },
      select: { id: true }
    });

    if (!manager) {
      throw new BadRequestException("Warehouse manager not found");
    }
  }

  private serializeWarehouse(warehouse: WarehousePayload) {
    return warehouse;
  }

  private serializeStockItem(item: StockItemPayload) {
    const quantity = decimalToNumber(item.quantity);
    const reserved = decimalToNumber(item.reservedQuantity);

    return {
      ...item,
      available: calculateAvailableStock(quantity, reserved)
    };
  }

  private publishLowStockForItems(items: StockItemPayload[]) {
    for (const item of items) {
      const quantity = decimalToNumber(item.quantity);
      const reserved = decimalToNumber(item.reservedQuantity);
      const available = calculateAvailableStock(quantity, reserved);
      const threshold = item.product.minOrderQty;

      if (available > threshold) {
        continue;
      }

      void this.notificationsService
        .createForPermission("warehouse.manage", {
          event: "stock.low",
          type: NotificationType.WARNING,
          title: "Low stock",
          body: `${item.product.sku} ${item.product.name}: ${available} ${item.unit} available`,
          data: {
            stockItemId: item.id,
            warehouseId: item.warehouseId,
            productId: item.productId,
            variantId: item.variantId,
            available,
            threshold,
            unit: item.unit
          }
        })
        .catch(() => undefined);
    }
  }

  private audit(
    client: PrismaService | Prisma.TransactionClient,
    actorId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    before?: unknown,
    after?: unknown
  ) {
    return client.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        before: before === undefined ? undefined : sanitizeJson(before),
        after: after === undefined ? undefined : sanitizeJson(after)
      }
    });
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

function cleanUnit(value: string | null | undefined) {
  return nullableString(value) ?? "pcs";
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function quantityDecimal(value: number) {
  return new Prisma.Decimal(roundQuantity(value));
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function calculateAvailableStock(quantity: number, reserved: number) {
  return roundQuantity(quantity - reserved);
}

function assertCanReserveStock(quantity: number, reserved: number, requested: number) {
  if (requested > calculateAvailableStock(quantity, reserved)) {
    throw new BadRequestException("Cannot reserve more than available stock");
  }
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

export const __warehouseTestUtils = {
  assertCanReserveStock,
  calculateAvailableStock,
  decimalToNumber,
  roundQuantity
};
