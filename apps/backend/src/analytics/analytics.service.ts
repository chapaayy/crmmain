import { Injectable } from "@nestjs/common";
import { DocumentType, LeadStatus, OrderStatus, PaymentStatus, Prisma, RoleCode, StockMovementType, TaskStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

const managerSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const productSelect = {
  id: true,
  sku: true,
  name: true,
  categoryId: true,
  minOrderQty: true,
  purchasePrice: true
} satisfies Prisma.ProductSelect;

type ManagerSummary = Prisma.UserGetPayload<{ select: typeof managerSelect }>;
type ProductSummary = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

interface ManagerAggregate {
  managerId: string | null;
  manager: ManagerSummary | null;
  ordersCount: number;
  salesTotal: number;
}

interface ProductAggregate {
  productId: string;
  product: ProductSummary;
  quantity: number;
  revenue: number;
  ordersCount: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(query: AnalyticsQueryDto, actorId: string) {
    const financeVisible = await this.canViewFinance(actorId);
    const [orders, sales, leads, products, managers, warehouse] = await Promise.all([
      this.orders(query),
      this.buildSales(query, financeVisible),
      this.leads(query),
      this.buildProducts(query, financeVisible),
      this.buildManagers(query, financeVisible),
      this.warehouse(query)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters: this.normalizeFilters(query),
      financeVisible,
      orders,
      sales,
      leads,
      products,
      managers,
      warehouse
    };
  }

  async orders(query: AnalyticsQueryDto) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const where = this.buildOrderWhere(query);
    const [total, today, week, month, byStatusRaw, overdueTasks, shipmentsToday] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: this.buildOrderWindowWhere(query, todayStart) }),
      this.prisma.order.count({ where: this.buildOrderWindowWhere(query, weekStart) }),
      this.prisma.order.count({ where: this.buildOrderWindowWhere(query, monthStart) }),
      this.prisma.order.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      }),
      this.countOverdueTasks(query),
      this.countShipmentsToday(query)
    ]);
    const byStatus = Object.values(OrderStatus).map((status) => ({
      status,
      count: byStatusRaw.find((item) => item.status === status)?._count._all ?? 0
    }));

    return {
      total,
      today,
      week,
      month,
      byStatus,
      overdueTasks,
      shipmentsToday
    };
  }

  async sales(query: AnalyticsQueryDto, actorId: string) {
    return this.buildSales(query, await this.canViewFinance(actorId));
  }

  async products(query: AnalyticsQueryDto, actorId: string) {
    return this.buildProducts(query, await this.canViewFinance(actorId));
  }

  async managers(query: AnalyticsQueryDto, actorId: string) {
    return this.buildManagers(query, await this.canViewFinance(actorId));
  }

  async warehouse(query: AnalyticsQueryDto) {
    const [warehousesTotal, warehousesActive, stockItems, shipmentsToday] = await Promise.all([
      this.prisma.warehouse.count({ where: { deletedAt: null } }),
      this.prisma.warehouse.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.stockItem.findMany({
        where: this.buildStockWhere(query),
        select: {
          id: true,
          quantity: true,
          reservedQuantity: true,
          unit: true,
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
            select: {
              id: true,
              sku: true,
              name: true
            }
          }
        }
      }),
      this.countShipmentsToday(query)
    ]);
    const serializedStock = stockItems.map((item) => {
      const quantity = decimalToNumber(item.quantity);
      const reserved = decimalToNumber(item.reservedQuantity);
      const available = roundQuantity(quantity - reserved);

      return {
        id: item.id,
        warehouse: item.warehouse,
        product: item.product,
        variant: item.variant,
        quantity,
        reserved,
        available,
        unit: item.unit,
        threshold: item.product.minOrderQty
      };
    });
    const lowStock = serializedStock
      .filter((item) => item.available <= item.threshold)
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);

    return {
      warehousesTotal,
      warehousesActive,
      stockItems: serializedStock.length,
      quantity: roundQuantity(serializedStock.reduce((sum, item) => sum + item.quantity, 0)),
      reserved: roundQuantity(serializedStock.reduce((sum, item) => sum + item.reserved, 0)),
      available: roundQuantity(serializedStock.reduce((sum, item) => sum + item.available, 0)),
      lowStock,
      shipmentsToday
    };
  }

  private async leads(query: AnalyticsQueryDto) {
    const where = this.buildLeadWhere(query);
    const [total, newLeads, converted, ordersFromLeads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({
        where: {
          ...where,
          status: LeadStatus.NEW
        }
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          OR: [{ convertedAt: { not: null } }, { customerId: { not: null } }]
        }
      }),
      this.prisma.order.count({
        where: {
          ...this.buildOrderWhere(query),
          leadId: {
            not: null
          }
        }
      })
    ]);

    return {
      total,
      new: newLeads,
      converted,
      ordersFromLeads,
      conversionRate: total > 0 ? roundPercent((converted / total) * 100) : 0
    };
  }

  private async buildSales(query: AnalyticsQueryDto, financeVisible: boolean) {
    if (!financeVisible) {
      return {
        financeVisible,
        salesTotal: null,
        averageCheck: null,
        unpaidInvoices: {
          count: null,
          total: null
        },
        margin: null,
        marginRate: null
      };
    }

    const salesWhere = this.buildSalesOrderWhere(query);
    const [orders, invoiceDocuments, orderItems] = await Promise.all([
      this.prisma.order.findMany({
        where: salesWhere,
        select: {
          id: true,
          total: true,
          paidAmount: true,
          paymentStatus: true
        }
      }),
      this.prisma.document.findMany({
        where: {
          deletedAt: null,
          type: DocumentType.INVOICE,
          order: {
            ...salesWhere,
            paymentStatus: {
              in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID]
            }
          }
        },
        select: {
          id: true,
          order: {
            select: {
              total: true,
              paidAmount: true
            }
          }
        }
      }),
      this.prisma.orderItem.findMany({
        where: {
          deletedAt: null,
          order: salesWhere,
          ...this.buildOrderItemCategoryFilter(query)
        },
        select: {
          quantity: true,
          total: true,
          product: {
            select: {
              purchasePrice: true
            }
          },
          variant: {
            select: {
              purchasePrice: true
            }
          }
        }
      })
    ]);
    const itemRevenue = roundMoney(orderItems.reduce((sum, item) => sum + decimalToNumber(item.total), 0));
    const salesTotal = query.categoryId ? itemRevenue : roundMoney(orders.reduce((sum, order) => sum + decimalToNumber(order.total), 0));
    const costTotal = orderItems.reduce((sum, item) => {
      const purchasePrice = item.variant?.purchasePrice ?? item.product.purchasePrice;

      if (!purchasePrice) {
        return sum;
      }

      return sum + decimalToNumber(item.quantity) * decimalToNumber(purchasePrice);
    }, 0);
    const margin = roundMoney(itemRevenue - costTotal);
    const unpaidTotal = roundMoney(
      invoiceDocuments.reduce((sum, document) => {
        const order = document.order;

        return sum + Math.max(0, decimalToNumber(order?.total) - decimalToNumber(order?.paidAmount));
      }, 0)
    );

    return {
      financeVisible,
      salesTotal,
      averageCheck: orders.length > 0 ? roundMoney(salesTotal / orders.length) : 0,
      unpaidInvoices: {
        count: invoiceDocuments.length,
        total: unpaidTotal
      },
      margin,
      marginRate: salesTotal > 0 ? roundPercent((margin / salesTotal) * 100) : 0
    };
  }

  private async buildProducts(query: AnalyticsQueryDto, financeVisible: boolean) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        deletedAt: null,
        order: this.buildSalesOrderWhere(query),
        ...this.buildOrderItemCategoryFilter(query)
      },
      select: {
        orderId: true,
        productId: true,
        quantity: true,
        total: true,
        product: {
          select: productSelect
        }
      }
    });
    const aggregates = new Map<string, ProductAggregate>();

    for (const item of items) {
      const current = aggregates.get(item.productId) ?? {
        productId: item.productId,
        product: item.product,
        quantity: 0,
        revenue: 0,
        ordersCount: 0
      };

      current.quantity = roundQuantity(current.quantity + decimalToNumber(item.quantity));
      current.revenue = roundMoney(current.revenue + decimalToNumber(item.total));
      current.ordersCount += 1;
      aggregates.set(item.productId, current);
    }

    return {
      popular: Array.from(aggregates.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)
        .map((item) => ({
          product: item.product,
          quantity: item.quantity,
          ordersCount: item.ordersCount,
          revenue: financeVisible ? item.revenue : null
        }))
    };
  }

  private async buildManagers(query: AnalyticsQueryDto, financeVisible: boolean) {
    const orders = await this.prisma.order.findMany({
      where: this.buildSalesOrderWhere(query),
      select: {
        id: true,
        managerId: true,
        total: true,
        manager: {
          select: managerSelect
        }
      }
    });
    const aggregates = new Map<string, ManagerAggregate>();

    for (const order of orders) {
      const key = order.managerId ?? "unassigned";
      const current = aggregates.get(key) ?? {
        managerId: order.managerId,
        manager: order.manager,
        ordersCount: 0,
        salesTotal: 0
      };

      current.ordersCount += 1;
      current.salesTotal = roundMoney(current.salesTotal + decimalToNumber(order.total));
      aggregates.set(key, current);
    }

    return {
      best: Array.from(aggregates.values())
        .sort((a, b) => (financeVisible ? b.salesTotal - a.salesTotal : b.ordersCount - a.ordersCount))
        .slice(0, 10)
        .map((item) => ({
          managerId: item.managerId,
          manager: item.manager,
          ordersCount: item.ordersCount,
          salesTotal: financeVisible ? item.salesTotal : null
        }))
    };
  }

  private buildOrderWhere(query: AnalyticsQueryDto, options: { ignoreDate?: boolean } = {}): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null
    };
    const and: Prisma.OrderWhereInput[] = [];
    const createdAt = options.ignoreDate ? undefined : this.dateFilter(query);

    if (createdAt) {
      where.createdAt = createdAt;
    }

    if (query.managerId) {
      where.managerId = query.managerId;
    }

    if (query.source) {
      and.push({
        OR: [
          {
            customer: {
              source: query.source
            }
          },
          {
            lead: {
              source: query.source
            }
          }
        ]
      });
    }

    if (query.categoryId) {
      and.push({
        items: {
          some: {
            deletedAt: null,
            OR: [
              {
                product: {
                  categoryId: query.categoryId
                }
              },
              {
                variant: {
                  categoryId: query.categoryId
                }
              }
            ]
          }
        }
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    return where;
  }

  private buildSalesOrderWhere(query: AnalyticsQueryDto): Prisma.OrderWhereInput {
    return {
      ...this.buildOrderWhere(query),
      status: {
        notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED]
      }
    };
  }

  private buildOrderWindowWhere(query: AnalyticsQueryDto, dateFrom: Date) {
    return {
      ...this.buildOrderWhere(query, { ignoreDate: true }),
      createdAt: {
        gte: dateFrom
      }
    };
  }

  private buildLeadWhere(query: AnalyticsQueryDto): Prisma.LeadWhereInput {
    return {
      deletedAt: null,
      ...(this.dateFilter(query) ? { createdAt: this.dateFilter(query) } : {}),
      ...(query.managerId ? { assignedToId: query.managerId } : {}),
      ...(query.source ? { source: query.source } : {})
    };
  }

  private buildStockWhere(query: AnalyticsQueryDto): Prisma.StockItemWhereInput {
    return {
      deletedAt: null,
      ...(query.categoryId
        ? {
            product: {
              categoryId: query.categoryId
            }
          }
        : {})
    };
  }

  private buildMovementWhere(query: AnalyticsQueryDto): Prisma.StockMovementWhereInput {
    return {
      deletedAt: null,
      ...(query.categoryId
        ? {
            product: {
              categoryId: query.categoryId
            }
          }
        : {})
    };
  }

  private buildOrderItemCategoryFilter(query: AnalyticsQueryDto): Prisma.OrderItemWhereInput {
    if (!query.categoryId) {
      return {};
    }

    return {
      OR: [
        {
          product: {
            categoryId: query.categoryId
          }
        },
        {
          variant: {
            categoryId: query.categoryId
          }
        }
      ]
    };
  }

  private dateFilter(query: AnalyticsQueryDto) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      createdAt.gte = startOfDay(new Date(query.dateFrom));
    }

    if (query.dateTo) {
      createdAt.lte = endOfDay(new Date(query.dateTo));
    }

    return Object.keys(createdAt).length > 0 ? createdAt : undefined;
  }

  private async countOverdueTasks(query: AnalyticsQueryDto) {
    return this.prisma.task.count({
      where: {
        deletedAt: null,
        dueAt: {
          lt: new Date()
        },
        status: {
          notIn: [TaskStatus.DONE, TaskStatus.CANCELLED]
        },
        ...(query.managerId ? { assignedToId: query.managerId } : {})
      }
    });
  }

  private async countShipmentsToday(query: AnalyticsQueryDto) {
    return this.prisma.stockMovement.count({
      where: {
        ...this.buildMovementWhere(query),
        type: StockMovementType.SHIPMENT,
        createdAt: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date())
        }
      }
    });
  }

  private async canViewFinance(actorId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: actorId,
        isActive: true,
        deletedAt: null
      },
      select: {
        primaryRole: true,
        roles: {
          where: { deletedAt: null },
          select: {
            role: {
              select: {
                code: true,
                deletedAt: true,
                permissions: {
                  where: { deletedAt: null },
                  select: {
                    permission: {
                      select: {
                        key: true,
                        deletedAt: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return false;
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));

    if (user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN)) {
      return true;
    }

    return user.roles.some(({ role }) =>
      role.deletedAt
        ? false
        : role.permissions.some(({ permission }) =>
            !permission.deletedAt && ["payments.read", "analytics.read_finance"].includes(permission.key)
          )
    );
  }

  private normalizeFilters(query: AnalyticsQueryDto) {
    return {
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      managerId: query.managerId ?? null,
      source: query.source ?? null,
      categoryId: query.categoryId ?? null
    };
  }
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);

  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const mondayOffset = (day + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);

  return result;
}

function startOfMonth(date: Date) {
  const result = startOfDay(date);
  result.setDate(1);

  return result;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
