import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationType, PaymentMethod, PaymentStatus, Prisma, TimelineEventType } from "@prisma/client";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderPaymentDto, CreatePaymentDto, UpdatePaymentDto } from "./dto/payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

const userSelect = {
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

const paymentSelect = {
  id: true,
  orderId: true,
  status: true,
  method: true,
  amount: true,
  currency: true,
  dueDate: true,
  paidAt: true,
  externalId: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      number: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      currency: true,
      managerId: true,
      customer: {
        select: customerSelect
      }
    }
  },
  createdBy: {
    select: userSelect
  },
  updatedBy: {
    select: userSelect
  }
} satisfies Prisma.PaymentSelect;

type PaymentPayload = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: PaymentQueryDto) {
    const where = this.buildWhere(query);
    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        select: paymentSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: payments.map((payment) => this.serializePayment(payment)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreatePaymentDto, actorId: string) {
    return this.createForOrder(dto.orderId, dto, actorId);
  }

  async get(id: string) {
    return { payment: this.serializePayment(await this.requirePayment(this.prisma, id)) };
  }

  async update(id: string, dto: UpdatePaymentDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await this.requirePayment(tx, id);
      const data: Prisma.PaymentUncheckedUpdateInput = {
        updatedById: actorId
      };
      const writable = data as Record<string, unknown>;

      assignIfDefined(writable, "status", dto.status);
      assignIfDefined(writable, "method", dto.method);
      assignIfDefined(writable, "amount", dto.amount, money);
      assignIfDefined(writable, "currency", dto.currency, normalizeCurrency);
      assignIfDefined(writable, "dueDate", dto.dueDate, (value) => new Date(value));
      assignIfDefined(writable, "paidAt", dto.paidAt, (value) => new Date(value));
      assignIfDefined(writable, "externalId", dto.externalId, nullableString);
      assignIfDefined(writable, "note", dto.note, nullableString);

      if (dto.status && !dto.paidAt && isCollectedPayment(dto.status) && !before.paidAt) {
        data.paidAt = new Date();
      }

      const payment = await tx.payment.update({
        where: { id },
        data,
        select: paymentSelect
      });

      await this.recalculateOrderPayment(tx, before.orderId, actorId);
      await tx.timelineEvent.create({
        data: {
          orderId: payment.orderId,
          customerId: payment.order.customer.id,
          actorId,
          type: TimelineEventType.PAYMENT_RECEIVED,
          title: "Payment updated",
          description: `${formatMoney(payment.amount)} ${payment.currency}`
        }
      });
      await this.audit(tx, actorId, AuditAction.UPDATE, "Payment", id, before, payment);

      return payment;
    });

    return { payment: this.serializePayment(result) };
  }

  async delete(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.requirePayment(tx, id);

      await tx.payment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedById: actorId
        }
      });
      await this.recalculateOrderPayment(tx, before.orderId, actorId);
      await tx.timelineEvent.create({
        data: {
          orderId: before.orderId,
          customerId: before.order.customer.id,
          actorId,
          type: TimelineEventType.PAYMENT_RECEIVED,
          title: "Payment deleted",
          description: `${formatMoney(before.amount)} ${before.currency}`
        }
      });
      await this.audit(tx, actorId, AuditAction.DELETE, "Payment", id, before);
    });

    return { success: true };
  }

  async listForOrder(orderId: string) {
    await this.requireOrder(this.prisma, orderId);
    const payments = await this.prisma.payment.findMany({
      where: { orderId, deletedAt: null },
      select: paymentSelect,
      orderBy: { createdAt: "desc" }
    });

    return { payments: payments.map((payment) => this.serializePayment(payment)) };
  }

  async createForOrder(orderId: string, dto: CreateOrderPaymentDto | CreatePaymentDto, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.requireOrder(tx, orderId);
      const status = dto.status ?? PaymentStatus.PAID;
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : isCollectedPayment(status) ? new Date() : undefined;

      const payment = await tx.payment.create({
        data: {
          orderId,
          status,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          amount: money(dto.amount),
          currency: normalizeCurrency(dto.currency ?? order.currency),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          paidAt,
          externalId: nullableString(dto.externalId),
          note: nullableString(dto.note),
          createdById: actorId,
          updatedById: actorId
        },
        select: paymentSelect
      });

      await this.recalculateOrderPayment(tx, orderId, actorId);
      await tx.timelineEvent.create({
        data: {
          orderId,
          customerId: order.customerId,
          actorId,
          type: TimelineEventType.PAYMENT_RECEIVED,
          title: "Payment received",
          description: `${formatMoney(payment.amount)} ${payment.currency}`
        }
      });
      await this.audit(tx, actorId, AuditAction.CREATE, "Payment", payment.id, undefined, payment);

      return payment;
    });

    this.publishPaymentReceived(result);

    return { payment: this.serializePayment(result) };
  }

  private buildWhere(query: PaymentQueryDto): Prisma.PaymentWhereInput {
    const paidAt: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      paidAt.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      paidAt.lte = new Date(query.dateTo);
    }

    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.customerId ? { order: { customerId: query.customerId } } : {}),
      ...(query.dateFrom || query.dateTo ? { paidAt } : {}),
      ...(query.search
        ? {
            OR: [
              { externalId: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
              { order: { number: { contains: query.search, mode: "insensitive" } } },
              { order: { customer: { name: { contains: query.search, mode: "insensitive" } } } },
              { order: { customer: { companyName: { contains: query.search, mode: "insensitive" } } } },
              { order: { customer: { phone: { contains: query.search, mode: "insensitive" } } } },
              { order: { customer: { email: { contains: query.search, mode: "insensitive" } } } }
            ]
          }
        : {})
    };
  }

  private async recalculateOrderPayment(tx: Prisma.TransactionClient, orderId: string, actorId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: {
        id: true,
        total: true,
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

    const paidAmount = roundMoney(
      order.payments.reduce((sum, payment) => (isCollectedPayment(payment.status) ? sum + decimalToNumber(payment.amount) : sum), 0)
    );
    const paymentStatus = resolvePaymentStatus(paidAmount, decimalToNumber(order.total));

    await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmount: money(paidAmount),
        paymentStatus,
        updatedById: actorId
      }
    });

    return paymentStatus;
  }

  private async requireOrder(client: DbClient, id: string) {
    const order = await client.order.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        number: true,
        currency: true,
        total: true,
        customerId: true
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  private async requirePayment(client: DbClient, id: string): Promise<PaymentPayload> {
    const payment = await client.payment.findFirst({
      where: { id, deletedAt: null },
      select: paymentSelect
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return payment;
  }

  private serializePayment(payment: PaymentPayload) {
    return payment;
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

  private publishPaymentReceived(payment: PaymentPayload) {
    void this.notificationsService
      .createForUsers([payment.order.managerId], {
        event: "payment.received",
        type: NotificationType.SUCCESS,
        title: "Payment received",
        body: `${formatMoney(payment.amount)} ${payment.currency} for ${payment.order.number}`,
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          orderNumber: payment.order.number,
          amount: payment.amount,
          currency: payment.currency,
          customerId: payment.order.customer.id
        }
      })
      .catch(() => undefined);
  }
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: Prisma.Decimal | number | string) {
  return decimalToNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = nullableString(value);

  return (normalized ?? "RUB").toUpperCase();
}

function nullableString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
