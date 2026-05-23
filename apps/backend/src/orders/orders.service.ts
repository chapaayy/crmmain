import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, DiscountType, OrderStatus, PaymentStatus, Prisma, TimelineEventType } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "../customers/dto/comment.dto";
import { CreateOrderDto, CreateOrderItemDto, UpdateOrderDto, UpdateOrderItemDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderQueryDto } from "./dto/order-query.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

const managerSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const customerSelect = {
  id: true,
  name: true,
  companyName: true,
  phone: true,
  email: true,
  inn: true
} satisfies Prisma.CustomerSelect;

const productSummarySelect = {
  id: true,
  sku: true,
  name: true
} satisfies Prisma.ProductSelect;

const variantSummarySelect = {
  id: true,
  sku: true,
  name: true,
  productId: true,
  retailPrice: true,
  wholesalePrice: true,
  product: {
    select: productSummarySelect
  }
} satisfies Prisma.ProductVariantSelect;

const orderItemSelect = {
  id: true,
  orderId: true,
  productId: true,
  variantId: true,
  sku: true,
  name: true,
  quantity: true,
  unit: true,
  unitPrice: true,
  discount: true,
  total: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: productSummarySelect
  },
  variant: {
    select: variantSummarySelect
  }
} satisfies Prisma.OrderItemSelect;

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: {
    select: managerSelect
  }
} satisfies Prisma.CommentSelect;

const timelineSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  occurredAt: true,
  createdAt: true,
  actor: {
    select: managerSelect
  }
} satisfies Prisma.TimelineEventSelect;

const statusHistorySelect = {
  id: true,
  orderId: true,
  previousStatus: true,
  status: true,
  comment: true,
  createdAt: true,
  changedBy: {
    select: managerSelect
  }
} satisfies Prisma.OrderStatusHistorySelect;

const orderListSelect = {
  id: true,
  number: true,
  status: true,
  customerId: true,
  managerId: true,
  currency: true,
  subtotal: true,
  discountType: true,
  discountValue: true,
  discount: true,
  taxRate: true,
  tax: true,
  total: true,
  paidAmount: true,
  paymentStatus: true,
  dueDate: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: customerSelect
  },
  manager: {
    select: managerSelect
  },
  _count: {
    select: {
      items: true,
      comments: true,
      payments: true,
      documents: true
    }
  }
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
  contactId: true,
  leadId: true,
  warehouseId: true,
  contact: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true
    }
  },
  lead: {
    select: {
      id: true,
      title: true,
      phone: true,
      email: true
    }
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true
    }
  },
  items: {
    where: { deletedAt: null },
    select: orderItemSelect,
    orderBy: { createdAt: "asc" }
  },
  statusHistory: {
    where: { deletedAt: null },
    select: statusHistorySelect,
    orderBy: { createdAt: "desc" }
  },
  comments: {
    where: { deletedAt: null },
    select: commentSelect,
    orderBy: { createdAt: "desc" },
    take: 20
  },
  events: {
    where: { deletedAt: null },
    select: timelineSelect,
    orderBy: { occurredAt: "desc" },
    take: 30
  }
} satisfies Prisma.OrderSelect;

type OrderPayload = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;
type OrderListPayload = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;
type OrderItemPayload = Prisma.OrderItemGetPayload<{ select: typeof orderItemSelect }>;
type VariantPayload = Prisma.ProductVariantGetPayload<{ select: typeof variantSummarySelect }>;

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.NEW, OrderStatus.CANCELLED],
  NEW: [OrderStatus.MANAGER_PROCESSING, OrderStatus.WAITING_PAYMENT, OrderStatus.CANCELLED],
  MANAGER_PROCESSING: [OrderStatus.WAITING_PAYMENT, OrderStatus.PAID, OrderStatus.RESERVED, OrderStatus.CANCELLED],
  WAITING_PAYMENT: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.RESERVED, OrderStatus.PICKING, OrderStatus.REFUNDED],
  RESERVED: [OrderStatus.PICKING, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  PICKING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.COMPLETED, OrderStatus.REFUNDED],
  COMPLETED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: []
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: OrderQueryDto) {
    const where = this.buildWhere(query);
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: orderListSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: orders.map((order) => this.serializeOrder(order)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateOrderDto, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.ensureOrderReferences(tx, dto.customerId, dto.contactId, dto.leadId, dto.managerId, dto.warehouseId);
      const discount = this.normalizeDiscount(dto.discountType, dto.discountValue);
      const created = await tx.order.create({
        data: {
          number: await this.nextOrderNumber(tx),
          status: OrderStatus.DRAFT,
          customerId: dto.customerId,
          contactId: nullableString(dto.contactId),
          leadId: nullableString(dto.leadId),
          managerId: nullableString(dto.managerId) ?? actorId,
          warehouseId: nullableString(dto.warehouseId),
          currency: normalizeCurrency(dto.currency),
          discountType: discount.type,
          discountValue: money(discount.value),
          taxRate: money(dto.taxRate ?? 0),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: nullableString(dto.notes),
          createdById: actorId,
          updatedById: actorId
        },
        select: { id: true }
      });

      for (const item of dto.items ?? []) {
        await this.createOrderItem(tx, created.id, item);
      }

      await this.recalculateOrder(tx, created.id);
      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          previousStatus: null,
          status: OrderStatus.DRAFT,
          comment: "Order created",
          changedById: actorId
        }
      });
      await tx.timelineEvent.create({
        data: {
          orderId: created.id,
          actorId,
          type: TimelineEventType.CREATED,
          title: "Order created"
        }
      });

      const detail = await this.requireOrder(tx, created.id);
      await this.audit(tx, actorId, AuditAction.CREATE, "Order", created.id, undefined, detail);

      return detail;
    });

    this.publishOrderEvent([order.managerId], "order.created", "Order created", order.number, {
      orderId: order.id,
      number: order.number,
      customerId: order.customerId,
      total: order.total
    });

    return { order: this.serializeOrder(order) };
  }

  async get(id: string) {
    return { order: this.serializeOrder(await this.requireOrder(this.prisma, id)) };
  }

  async update(id: string, dto: UpdateOrderDto, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireOrder(tx, id);
      const customerId = dto.customerId ?? before.customerId;

      const contactId = dto.contactId !== undefined ? dto.contactId : before.contactId;

      await this.ensureOrderReferences(tx, customerId, contactId, dto.leadId, dto.managerId, dto.warehouseId);

      const data: Prisma.OrderUncheckedUpdateInput = {
        updatedById: actorId
      };
      const writable = data as Record<string, unknown>;
      const discount = dto.discountType !== undefined || dto.discountValue !== undefined
        ? this.normalizeDiscount(dto.discountType ?? before.discountType, dto.discountValue ?? decimalToNumber(before.discountValue))
        : undefined;

      assignIfDefined(writable, "customerId", dto.customerId);
      assignIfDefined(writable, "contactId", dto.contactId, nullableString);
      assignIfDefined(writable, "leadId", dto.leadId, nullableString);
      assignIfDefined(writable, "managerId", dto.managerId, nullableString);
      assignIfDefined(writable, "warehouseId", dto.warehouseId, nullableString);
      assignIfDefined(writable, "currency", dto.currency, normalizeCurrency);
      assignIfDefined(writable, "dueDate", dto.dueDate, (value) => new Date(value));
      assignIfDefined(writable, "notes", dto.notes, nullableString);
      assignIfDefined(writable, "taxRate", dto.taxRate, money);

      if (discount) {
        data.discountType = discount.type;
        data.discountValue = money(discount.value);
      }

      await tx.order.update({ where: { id }, data });
      await this.recalculateOrder(tx, id);

      const detail = await this.requireOrder(tx, id);
      await tx.timelineEvent.create({
        data: {
          orderId: id,
          actorId,
          type: TimelineEventType.UPDATED,
          title: "Order updated",
          description: detail.number
        }
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "Order", id, before, detail);

      return detail;
    });

    this.publishOrderEvent([order.managerId], "order.status_changed", "Order status changed", `${order.number} -> ${order.status}`, {
      orderId: order.id,
      number: order.number,
      status: order.status,
      customerId: order.customerId
    });

    return { order: this.serializeOrder(order) };
  }

  async delete(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.requireOrder(tx, id);
      const deletedAt = new Date();

      await tx.orderItem.updateMany({
        where: { orderId: id, deletedAt: null },
        data: { deletedAt }
      });
      await tx.order.update({
        where: { id },
        data: {
          deletedAt,
          updatedById: actorId
        }
      });
      await tx.timelineEvent.create({
        data: {
          orderId: id,
          actorId,
          type: TimelineEventType.UPDATED,
          title: "Order deleted",
          description: before.number
        }
      });
      await this.audit(tx, actorId, AuditAction.DELETE, "Order", id, before);
    });

    return { success: true };
  }

  async createItem(orderId: string, dto: CreateOrderItemDto, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.requireOrder(tx, orderId);
      const item = await this.createOrderItem(tx, orderId, dto);
      await this.recalculateOrder(tx, orderId);

      const detail = await this.requireOrder(tx, orderId);
      await tx.timelineEvent.create({
        data: {
          orderId,
          actorId,
          type: TimelineEventType.UPDATED,
          title: "Order item added",
          description: item.name
        }
      });
      await this.audit(tx, actorId, AuditAction.CREATE, "OrderItem", item.id, undefined, item);

      return detail;
    });

    return { order: this.serializeOrder(order) };
  }

  async updateItem(orderId: string, itemId: string, dto: UpdateOrderItemDto, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.requireOrder(tx, orderId);
      const before = await this.requireOrderItem(tx, orderId, itemId);
      const variant = dto.productVariantId ? await this.requireVariant(tx, dto.productVariantId) : before.variant;

      if (!variant) {
        throw new BadRequestException("Order item variant is required");
      }

      const quantity = dto.quantity ?? decimalToNumber(before.quantity);
      const unitPrice = dto.unitPrice ?? (dto.productVariantId ? this.defaultPrice(variant) : decimalToNumber(before.unitPrice));
      const discount = dto.discount ?? decimalToNumber(before.discount);
      const line = calculateLine(quantity, unitPrice, discount);
      const item = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          productId: variant.productId,
          variantId: variant.id,
          sku: variant.sku,
          name: variant.name,
          quantity: quantityDecimal(quantity),
          unitPrice: money(unitPrice),
          discount: money(line.discount),
          total: money(line.total),
          ...(dto.unit !== undefined ? { unit: cleanUnit(dto.unit) } : {}),
          ...(dto.notes !== undefined ? { notes: nullableString(dto.notes) } : {})
        },
        select: orderItemSelect
      });

      await this.recalculateOrder(tx, orderId);
      const detail = await this.requireOrder(tx, orderId);
      await tx.timelineEvent.create({
        data: {
          orderId,
          actorId,
          type: TimelineEventType.UPDATED,
          title: "Order item updated",
          description: item.name
        }
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "OrderItem", itemId, before, item);

      return detail;
    });

    return { order: this.serializeOrder(order) };
  }

  async deleteItem(orderId: string, itemId: string, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.requireOrder(tx, orderId);
      const before = await this.requireOrderItem(tx, orderId, itemId);

      await tx.orderItem.update({
        where: { id: itemId },
        data: { deletedAt: new Date() }
      });
      await this.recalculateOrder(tx, orderId);

      const detail = await this.requireOrder(tx, orderId);
      await tx.timelineEvent.create({
        data: {
          orderId,
          actorId,
          type: TimelineEventType.UPDATED,
          title: "Order item deleted",
          description: before.name
        }
      });
      await this.audit(tx, actorId, AuditAction.DELETE, "OrderItem", itemId, before);

      return detail;
    });

    return { order: this.serializeOrder(order) };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireOrder(tx, id);

      if (before.status === dto.status) {
        return before;
      }

      if (!allowedTransitions[before.status].includes(dto.status)) {
        throw new BadRequestException(`Cannot move order from ${before.status} to ${dto.status}`);
      }

      const now = new Date();
      await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.MANAGER_PROCESSING && !before.confirmedAt ? { confirmedAt: now } : {}),
          ...(dto.status === OrderStatus.SHIPPED && !before.shippedAt ? { shippedAt: now } : {}),
          ...(dto.status === OrderStatus.DELIVERED && !before.deliveredAt ? { deliveredAt: now } : {}),
          updatedById: actorId
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: before.status,
          status: dto.status,
          comment: nullableString(dto.comment),
          changedById: actorId
        }
      });
      await tx.timelineEvent.create({
        data: {
          orderId: id,
          actorId,
          type: TimelineEventType.STATUS_CHANGED,
          title: `Order status changed to ${dto.status}`,
          description: nullableString(dto.comment) ?? before.number
        }
      });

      const detail = await this.requireOrder(tx, id);
      await this.audit(tx, actorId, AuditAction.UPDATE, "OrderStatus", id, before, detail);

      return detail;
    });

    return { order: this.serializeOrder(order) };
  }

  async statusHistory(id: string) {
    await this.requireOrder(this.prisma, id);
    const history = await this.prisma.orderStatusHistory.findMany({
      where: { orderId: id, deletedAt: null },
      select: statusHistorySelect,
      orderBy: { createdAt: "desc" }
    });

    return { history };
  }

  async addComment(orderId: string, dto: CreateCommentDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrder(tx, orderId);
      const comment = await tx.comment.create({
        data: {
          orderId,
          authorId: actorId,
          body: requiredString(dto.body, "Comment")
        },
        select: commentSelect
      });

      await tx.timelineEvent.create({
        data: {
          orderId,
          actorId,
          type: TimelineEventType.COMMENTED,
          title: "Comment added",
          description: comment.body
        }
      });
      await this.audit(tx, actorId, AuditAction.CREATE, "OrderComment", comment.id, undefined, comment);

      return { comment, order };
    });

    this.publishOrderEvent([result.order.managerId], "comment.created", "Comment added", result.order.number, {
      orderId,
      commentId: result.comment.id,
      entityType: "ORDER"
    });

    return { comment: result.comment };
  }

  private buildWhere(query: OrderQueryDto): Prisma.OrderWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      createdAt.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      createdAt.lte = new Date(query.dateTo);
    }

    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: "insensitive" } },
              { customer: { name: { contains: query.search, mode: "insensitive" } } },
              { customer: { companyName: { contains: query.search, mode: "insensitive" } } },
              { customer: { phone: { contains: query.search, mode: "insensitive" } } },
              { customer: { email: { contains: query.search, mode: "insensitive" } } },
              { customer: { inn: { contains: query.search, mode: "insensitive" } } },
              { lead: { title: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async createOrderItem(tx: Prisma.TransactionClient, orderId: string, dto: CreateOrderItemDto) {
    const variant = await this.requireVariant(tx, dto.productVariantId);
    const unitPrice = dto.unitPrice ?? this.defaultPrice(variant);
    const line = calculateLine(dto.quantity, unitPrice, dto.discount ?? 0);

    return tx.orderItem.create({
      data: {
        orderId,
        productId: variant.productId,
        variantId: variant.id,
        sku: variant.sku,
        name: variant.name,
        quantity: quantityDecimal(dto.quantity),
        unit: cleanUnit(dto.unit),
        unitPrice: money(unitPrice),
        discount: money(line.discount),
        total: money(line.total),
        notes: nullableString(dto.notes)
      },
      select: orderItemSelect
    });
  }

  private async recalculateOrder(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        discountType: true,
        discountValue: true,
        taxRate: true,
        items: {
          where: { deletedAt: null },
          select: {
            total: true
          }
        },
        payments: {
          where: { deletedAt: null },
          select: {
            amount: true,
            status: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const subtotal = roundMoney(order.items.reduce((sum, item) => sum + decimalToNumber(item.total), 0));
    const discount = calculateOrderDiscount(subtotal, order.discountType, decimalToNumber(order.discountValue));
    const taxable = Math.max(0, subtotal - discount);
    const tax = roundMoney((taxable * decimalToNumber(order.taxRate)) / 100);
    const total = roundMoney(taxable + tax);
    const paidAmount = roundMoney(
      order.payments.reduce((sum, payment) => (isCollectedPayment(payment.status) ? sum + decimalToNumber(payment.amount) : sum), 0)
    );

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: money(subtotal),
        discount: money(discount),
        tax: money(tax),
        total: money(total),
        paidAmount: money(paidAmount),
        paymentStatus: resolvePaymentStatus(paidAmount, total)
      }
    });
  }

  private async requireOrder(client: DbClient, id: string): Promise<OrderPayload> {
    const order = await client.order.findFirst({
      where: { id, deletedAt: null },
      select: orderDetailSelect
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  private async requireOrderItem(tx: Prisma.TransactionClient, orderId: string, itemId: string): Promise<OrderItemPayload> {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
      select: orderItemSelect
    });

    if (!item) {
      throw new NotFoundException("Order item not found");
    }

    return item;
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
      select: variantSummarySelect
    });

    if (!variant) {
      throw new NotFoundException("Product variant not found or inactive");
    }

    return variant;
  }

  private async ensureOrderReferences(
    tx: Prisma.TransactionClient,
    customerId: string,
    contactId?: string | null,
    leadId?: string | null,
    managerId?: string | null,
    warehouseId?: string | null
  ) {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true }
    });

    if (!customer) {
      throw new BadRequestException("Customer not found");
    }

    if (contactId) {
      const contact = await tx.customerContact.findFirst({
        where: { id: contactId, customerId, deletedAt: null },
        select: { id: true }
      });

      if (!contact) {
        throw new BadRequestException("Customer contact not found");
      }
    }

    if (leadId) {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, deletedAt: null },
        select: { id: true }
      });

      if (!lead) {
        throw new BadRequestException("Lead not found");
      }
    }

    if (managerId) {
      const manager = await tx.user.findFirst({
        where: { id: managerId, isActive: true, deletedAt: null },
        select: { id: true }
      });

      if (!manager) {
        throw new BadRequestException("Manager not found");
      }
    }

    if (warehouseId) {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: warehouseId, isActive: true, deletedAt: null },
        select: { id: true }
      });

      if (!warehouse) {
        throw new BadRequestException("Warehouse not found");
      }
    }
  }

  private normalizeDiscount(type: DiscountType | undefined, value: number | undefined) {
    const discountType = type ?? DiscountType.NONE;
    const discountValue = discountType === DiscountType.NONE ? 0 : value ?? 0;

    if (discountType === DiscountType.PERCENT && discountValue > 100) {
      throw new BadRequestException("Percent discount cannot exceed 100");
    }

    return {
      type: discountType,
      value: discountValue
    };
  }

  private defaultPrice(variant: VariantPayload) {
    return decimalToNumber(variant.wholesalePrice ?? variant.retailPrice ?? 0);
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient) {
    const prefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await tx.order.count({
      where: {
        number: {
          startsWith: `ORD-${prefix}`
        }
      }
    });

    return `ORD-${prefix}-${String(count + 1).padStart(4, "0")}`;
  }

  private serializeOrder(order: OrderPayload | OrderListPayload) {
    return order;
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    before?: unknown,
    after?: unknown
  ) {
    return tx.auditLog.create({
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

  private publishOrderEvent(userIds: Array<string | null | undefined>, event: string, title: string, body: string | undefined, data: Record<string, unknown>) {
    void this.notificationsService
      .createForUsers(userIds, {
        event,
        title,
        body,
        data
      })
      .catch(() => undefined);
  }
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function calculateLine(quantity: number, unitPrice: number, discount: number) {
  if (quantity <= 0) {
    throw new BadRequestException("Quantity must be greater than zero");
  }

  const gross = roundMoney(quantity * unitPrice);
  const normalizedDiscount = Math.min(roundMoney(discount), gross);

  return {
    discount: normalizedDiscount,
    total: roundMoney(gross - normalizedDiscount)
  };
}

function calculateOrderDiscount(subtotal: number, type: DiscountType, value: number) {
  if (type === DiscountType.NONE) {
    return 0;
  }

  if (type === DiscountType.PERCENT) {
    return roundMoney((subtotal * value) / 100);
  }

  return Math.min(roundMoney(value), subtotal);
}

function isCollectedPayment(status: PaymentStatus) {
  return status === PaymentStatus.PAID || status === PaymentStatus.PARTIALLY_PAID || status === PaymentStatus.OVERPAID;
}

function resolvePaymentStatus(paidAmount: number, orderTotal: number) {
  if (paidAmount <= 0) {
    return PaymentStatus.UNPAID;
  }

  if (paidAmount < orderTotal) {
    return PaymentStatus.PARTIALLY_PAID;
  }

  if (paidAmount === orderTotal) {
    return PaymentStatus.PAID;
  }

  return PaymentStatus.OVERPAID;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function money(value: number) {
  return new Prisma.Decimal(roundMoney(value));
}

function quantityDecimal(value: number) {
  return new Prisma.Decimal(Math.round(value * 1000) / 1000);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function normalizeCurrency(value: string | null | undefined) {
  return (nullableString(value) ?? "RUB").toUpperCase();
}

function cleanUnit(value: string | null | undefined) {
  return nullableString(value) ?? "pcs";
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const __ordersTestUtils = {
  calculateLine,
  calculateOrderDiscount,
  resolvePaymentStatus,
  decimalToNumber,
  roundMoney
};
