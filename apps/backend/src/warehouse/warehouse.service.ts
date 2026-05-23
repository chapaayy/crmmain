import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationType, OrderStatus, Prisma, StockMovementType, TimelineEventType } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStockOperationDto, StockAdjustDto, StockLineDto, StockReceiptDto, StockWriteoffDto } from "./dto/stock-operation.dto";
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
      stockItems: true,
      orders: true
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
  orderId: true,
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
  order: {
    select: {
      id: true,
      number: true,
      status: true
    }
  },
  createdBy: {
    select: managerSelect
  }
} satisfies Prisma.StockMovementSelect;

const orderForStockSelect = {
  id: true,
  number: true,
  status: true,
  warehouseId: true,
  items: {
    where: { deletedAt: null },
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      unit: true,
      variant: {
        select: {
          id: true,
          sku: true,
          name: true
        }
      }
    }
  }
} satisfies Prisma.OrderSelect;

type WarehousePayload = Prisma.WarehouseGetPayload<{ select: typeof warehouseSelect }>;
type StockItemPayload = Prisma.StockItemGetPayload<{ select: typeof stockItemSelect }>;
type VariantPayload = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;
type OrderForStockPayload = Prisma.OrderGetPayload<{ select: typeof orderForStockSelect }>;

interface OrderStockBalance {
  reserved: number;
  shipped: number;
}

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

  async reserve(dto: OrderStockOperationDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrderForStock(tx, dto.orderId);
      const lines = await this.resolveOrderLines(order, dto.items);
      const balances = await this.getOrderMovementBalances(tx, dto.orderId);
      const orderedQuantities = this.orderQuantities(order);
      const stockItems: StockItemPayload[] = [];

      await this.ensureOrderWarehouse(tx, order, dto.warehouseId, actorId);

      for (const line of lines) {
        const balance = balances.get(line.productVariantId) ?? { reserved: 0, shipped: 0 };
        const orderedQuantity = orderedQuantities.get(line.productVariantId) ?? 0;
        const reservable = roundQuantity(orderedQuantity - balance.reserved - balance.shipped);

        if (line.quantity > reservable) {
          throw new BadRequestException("Reservation quantity exceeds remaining order quantity");
        }

        const item = await this.changeReservation(tx, dto.warehouseId, line.productVariantId, line.quantity, actorId, cleanUnit(line.unit), "reserve");

        await this.createMovement(tx, {
          type: StockMovementType.RESERVATION,
          stockItem: item,
          quantity: line.quantity,
          actorId,
          orderId: dto.orderId,
          reference: dto.reference ?? order.number,
          note: line.note ?? dto.note,
          balanceBefore: item.balanceBefore,
          balanceAfter: item.balanceAfter
        });
        stockItems.push(item.stockItem);
      }

      await this.setOrderStatusIfNeeded(tx, order, OrderStatus.RESERVED, actorId, "Stock reserved");
      await this.audit(tx, actorId, AuditAction.UPDATE, "StockReservation", dto.orderId, undefined, {
        orderId: dto.orderId,
        warehouseId: dto.warehouseId,
        items: lines
      });

      return { stockItems, orderId: dto.orderId };
    });

    this.publishLowStockForItems(result.stockItems);

    return { stockItems: result.stockItems.map((item) => this.serializeStockItem(item)), orderId: result.orderId };
  }

  async releaseReservation(dto: OrderStockOperationDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrderForStock(tx, dto.orderId);
      const lines = await this.resolveOrderLines(order, dto.items);
      const balances = await this.getOrderMovementBalances(tx, dto.orderId);
      const stockItems: StockItemPayload[] = [];

      await this.ensureOrderWarehouse(tx, order, dto.warehouseId, actorId);

      for (const line of lines) {
        const balance = balances.get(line.productVariantId) ?? { reserved: 0, shipped: 0 };

        if (line.quantity > balance.reserved) {
          throw new BadRequestException("Cannot release more than this order has reserved");
        }

        const item = await this.changeReservation(tx, dto.warehouseId, line.productVariantId, line.quantity, actorId, cleanUnit(line.unit), "release");

        await this.createMovement(tx, {
          type: StockMovementType.RELEASE_RESERVATION,
          stockItem: item,
          quantity: line.quantity,
          actorId,
          orderId: dto.orderId,
          reference: dto.reference ?? order.number,
          note: line.note ?? dto.note,
          balanceBefore: item.balanceBefore,
          balanceAfter: item.balanceAfter
        });
        stockItems.push(item.stockItem);
      }

      await tx.timelineEvent.create({
        data: {
          orderId: dto.orderId,
          actorId,
          type: TimelineEventType.STOCK_MOVED,
          title: "Stock reservation released",
          description: dto.note
        }
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "StockReleaseReservation", dto.orderId, undefined, {
        orderId: dto.orderId,
        warehouseId: dto.warehouseId,
        items: lines
      });

      return { stockItems, orderId: dto.orderId };
    });

    this.publishLowStockForItems(result.stockItems);

    return { stockItems: result.stockItems.map((item) => this.serializeStockItem(item)), orderId: result.orderId };
  }

  async shipOrder(dto: OrderStockOperationDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrderForStock(tx, dto.orderId);
      const lines = await this.resolveOrderLines(order, dto.items);
      const balances = await this.getOrderMovementBalances(tx, dto.orderId);
      const orderedQuantities = this.orderQuantities(order);
      const stockItems: StockItemPayload[] = [];

      await this.ensureOrderWarehouse(tx, order, dto.warehouseId, actorId);

      for (const line of lines) {
        const balance = balances.get(line.productVariantId) ?? { reserved: 0, shipped: 0 };
        const orderedQuantity = orderedQuantities.get(line.productVariantId) ?? 0;
        const shippable = roundQuantity(orderedQuantity - balance.shipped);
        const reservedToConsume = Math.min(balance.reserved, line.quantity);

        if (line.quantity > shippable) {
          throw new BadRequestException("Shipment quantity exceeds remaining order quantity");
        }

        const item = await this.shipQuantity(tx, dto.warehouseId, line.productVariantId, line.quantity, reservedToConsume, actorId, cleanUnit(line.unit));

        await this.createMovement(tx, {
          type: StockMovementType.SHIPMENT,
          stockItem: item,
          quantity: line.quantity,
          actorId,
          orderId: dto.orderId,
          reference: dto.reference ?? order.number,
          note: line.note ?? dto.note,
          balanceBefore: item.balanceBefore,
          balanceAfter: item.balanceAfter
        });
        stockItems.push(item.stockItem);
      }

      await this.setOrderStatusIfNeeded(tx, order, OrderStatus.SHIPPED, actorId, "Order shipped from warehouse");
      await this.audit(tx, actorId, AuditAction.UPDATE, "StockShipment", dto.orderId, undefined, {
        orderId: dto.orderId,
        warehouseId: dto.warehouseId,
        items: lines
      });

      return { stockItems, orderId: dto.orderId };
    });

    this.publishLowStockForItems(result.stockItems);

    return { stockItems: result.stockItems.map((item) => this.serializeStockItem(item)), orderId: result.orderId };
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
      ...(query.orderId ? { orderId: query.orderId } : {}),
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
              { variant: { sku: { contains: query.search, mode: "insensitive" } } },
              { order: { number: { contains: query.search, mode: "insensitive" } } }
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
      throw new BadRequestException(useAvailableOnly ? "Cannot write off more than available stock" : "Cannot ship more than physical stock");
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

  private async changeReservation(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
    actorId: string,
    unit: string,
    mode: "reserve" | "release"
  ) {
    const item = await this.getOrCreateStockItem(tx, warehouseId, productVariantId, actorId, unit);
    const physical = decimalToNumber(item.quantity);
    const beforeReserved = decimalToNumber(item.reservedQuantity);
    const available = calculateAvailableStock(physical, beforeReserved);
    const afterReserved = mode === "reserve" ? roundQuantity(beforeReserved + quantity) : roundQuantity(beforeReserved - quantity);

    if (mode === "reserve") {
      assertCanReserveStock(physical, beforeReserved, quantity);
    }

    if (mode === "release" && quantity > beforeReserved) {
      throw new BadRequestException("Cannot release more than reserved stock");
    }

    const stockItem = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        reservedQuantity: quantityDecimal(afterReserved),
        unit,
        updatedById: actorId
      },
      select: stockItemSelect
    });

    return { stockItem, balanceBefore: beforeReserved, balanceAfter: afterReserved };
  }

  private async shipQuantity(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
    reservedToConsume: number,
    actorId: string,
    unit: string
  ) {
    const item = await this.getOrCreateStockItem(tx, warehouseId, productVariantId, actorId, unit);
    const before = decimalToNumber(item.quantity);
    const beforeReserved = decimalToNumber(item.reservedQuantity);
    const available = calculateAvailableStock(before, beforeReserved);
    const unreservedToShip = roundQuantity(quantity - reservedToConsume);

    if (quantity > before) {
      throw new BadRequestException("Cannot ship more than physical stock");
    }

    if (reservedToConsume > beforeReserved) {
      throw new BadRequestException("Cannot ship more than reserved stock");
    }

    if (unreservedToShip > available) {
      throw new BadRequestException("Cannot ship more than reserved or available stock");
    }

    const after = roundQuantity(before - quantity);
    const reservedAfter = roundQuantity(beforeReserved - reservedToConsume);

    if (after < reservedAfter) {
      throw new BadRequestException("Shipment would leave reserved stock above physical quantity");
    }

    const stockItem = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        quantity: quantityDecimal(after),
        reservedQuantity: quantityDecimal(reservedAfter),
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

  private async requireOrderForStock(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: orderForStockSelect
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.items.length === 0) {
      throw new BadRequestException("Order has no items");
    }

    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED].includes(order.status)) {
      throw new BadRequestException(`Cannot move stock for order in ${order.status} status`);
    }

    return order;
  }

  private async resolveOrderLines(
    order: OrderForStockPayload,
    requestedItems?: StockLineDto[]
  ) {
    const sourceLines = requestedItems?.length
      ? requestedItems
      : order.items.map((item) => {
          if (!item.variantId) {
            throw new BadRequestException(`Order item ${item.id} has no product variant`);
          }

          return {
            productVariantId: item.variantId,
            quantity: decimalToNumber(item.quantity),
            unit: item.unit,
            note: undefined
          };
        });
    const orderQuantities = new Map<string, number>();

    for (const item of order.items) {
      if (item.variantId) {
        orderQuantities.set(item.variantId, roundQuantity((orderQuantities.get(item.variantId) ?? 0) + decimalToNumber(item.quantity)));
      }
    }

    const lines = new Map<string, StockLineDto>();

    for (const line of sourceLines) {
      if (line.quantity <= 0) {
        throw new BadRequestException("Stock operation quantity must be greater than zero");
      }

      const orderedQuantity = orderQuantities.get(line.productVariantId);

      if (!orderedQuantity) {
        throw new BadRequestException("Stock operation item is not present in order");
      }

      const existing = lines.get(line.productVariantId);
      const nextQuantity = roundQuantity((existing?.quantity ?? 0) + line.quantity);

      if (nextQuantity > orderedQuantity) {
        throw new BadRequestException("Stock operation quantity exceeds order item quantity");
      }

      lines.set(line.productVariantId, {
        productVariantId: line.productVariantId,
        quantity: nextQuantity,
        unit: line.unit ?? existing?.unit,
        note: line.note ?? existing?.note
      });
    }

    return [...lines.values()];
  }

  private orderQuantities(order: OrderForStockPayload) {
    const quantities = new Map<string, number>();

    for (const item of order.items) {
      if (item.variantId) {
        quantities.set(item.variantId, roundQuantity((quantities.get(item.variantId) ?? 0) + decimalToNumber(item.quantity)));
      }
    }

    return quantities;
  }

  private async getOrderMovementBalances(tx: Prisma.TransactionClient, orderId: string) {
    const movements = await tx.stockMovement.findMany({
      where: {
        orderId,
        deletedAt: null,
        type: {
          in: [StockMovementType.RESERVATION, StockMovementType.RELEASE_RESERVATION, StockMovementType.SHIPMENT]
        }
      },
      select: {
        type: true,
        variantId: true,
        quantity: true
      },
      orderBy: { createdAt: "asc" }
    });
    const balances = new Map<string, OrderStockBalance>();

    for (const movement of movements) {
      if (!movement.variantId) {
        continue;
      }

      const current = balances.get(movement.variantId) ?? { reserved: 0, shipped: 0 };
      const quantity = decimalToNumber(movement.quantity);

      if (movement.type === StockMovementType.RESERVATION) {
        current.reserved = roundQuantity(current.reserved + quantity);
      } else if (movement.type === StockMovementType.RELEASE_RESERVATION) {
        current.reserved = roundQuantity(Math.max(0, current.reserved - quantity));
      } else if (movement.type === StockMovementType.SHIPMENT) {
        current.shipped = roundQuantity(current.shipped + quantity);
        current.reserved = roundQuantity(Math.max(0, current.reserved - quantity));
      }

      balances.set(movement.variantId, current);
    }

    return balances;
  }

  private async ensureOrderWarehouse(
    tx: Prisma.TransactionClient,
    order: OrderForStockPayload,
    warehouseId: string,
    actorId: string
  ) {
    if (order.warehouseId && order.warehouseId !== warehouseId) {
      throw new BadRequestException("Order is assigned to another warehouse");
    }

    if (!order.warehouseId) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          warehouseId,
          updatedById: actorId
        }
      });
      order.warehouseId = warehouseId;
    }
  }

  private async setOrderStatusIfNeeded(
    tx: Prisma.TransactionClient,
    order: OrderForStockPayload,
    status: OrderStatus,
    actorId: string,
    comment: string
  ) {
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(order.status)) {
      return;
    }

    if (order.status === status) {
      await tx.timelineEvent.create({
        data: {
          orderId: order.id,
          actorId,
          type: TimelineEventType.STOCK_MOVED,
          title: comment
        }
      });
      return;
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        ...(status === OrderStatus.SHIPPED ? { shippedAt: new Date() } : {}),
        updatedById: actorId
      }
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        status,
        comment,
        changedById: actorId
      }
    });
    await tx.timelineEvent.create({
      data: {
        orderId: order.id,
        actorId,
        type: TimelineEventType.STOCK_MOVED,
        title: comment,
        description: `Order status changed to ${status}`
      }
    });
  }

  private createMovement(
    tx: Prisma.TransactionClient,
    input: {
      type: StockMovementType;
      stockItem: { stockItem: StockItemPayload };
      quantity: number;
      actorId: string;
      orderId?: string;
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
        orderId: input.orderId,
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
