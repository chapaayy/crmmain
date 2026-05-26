import { Injectable } from "@nestjs/common";
import { DocumentType, LeadStatus, OrderStatus, PaymentStatus, PayrollRunStatus, Prisma, RoleCode, StockMovementType, TaskStatus, TimeEntryStatus } from "@prisma/client";
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

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(query: AnalyticsQueryDto, actorId: string) {
    const access = await this.getAnalyticsAccess(actorId);
    const [orders, sales, leads, products, managers, warehouse, payroll] = await Promise.all([
      this.orders(query),
      this.buildSales(query, access.finance),
      this.leads(query),
      this.buildProducts(query, access.finance),
      this.buildManagers(query, access.finance),
      this.warehouse(query),
      this.payroll(query, access.payroll)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters: this.normalizeFilters(query),
      financeVisible: access.finance,
      orders,
      sales,
      leads,
      products,
      managers,
      warehouse,
      payroll
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
    const stockWhere = this.buildStockWhere(query);
    const [warehousesTotal, warehousesActive, stockAggregate, lowStockCandidates, shipmentsToday] = await Promise.all([
      this.prisma.warehouse.count({ where: { deletedAt: null } }),
      this.prisma.warehouse.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.stockItem.aggregate({
        where: stockWhere,
        _count: { _all: true },
        _sum: {
          quantity: true,
          reservedQuantity: true
        }
      }),
      this.prisma.stockItem.findMany({
        where: stockWhere,
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
        },
        orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }],
        take: 200
      }),
      this.countShipmentsToday(query)
    ]);
    const lowStock = lowStockCandidates.map((item) => {
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
    })
      .filter((item) => item.available <= item.threshold)
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);
    const quantity = decimalToNumber(stockAggregate._sum.quantity);
    const reserved = decimalToNumber(stockAggregate._sum.reservedQuantity);

    return {
      warehousesTotal,
      warehousesActive,
      stockItems: stockAggregate._count._all,
      quantity: roundQuantity(quantity),
      reserved: roundQuantity(reserved),
      available: roundQuantity(quantity - reserved),
      lowStock,
      shipmentsToday
    };
  }

  private async payroll(query: AnalyticsQueryDto, visible: boolean) {
    if (!visible) {
      return {
        visible,
        salaryFund: null,
        accrued: null,
        bonuses: null,
        penalties: null,
        commissions: null,
        net: null,
        paid: null,
        unpaid: null,
        workedHours: null,
        overtimeHours: null,
        unapprovedHours: null
      };
    }

    const periodWhere = this.buildPayrollPeriodWhere(query);
    const runWhere: Prisma.PayrollRunWhereInput = {
      deletedAt: null,
      status: { not: PayrollRunStatus.CANCELLED },
      period: periodWhere
    };
    const [salaryFund, runTotals, paidTotals, lineTotals, unapprovedEntries] = await Promise.all([
      this.prisma.employeeProfile.aggregate({
        where: { deletedAt: null, isActive: true },
        _sum: { baseSalary: true }
      }),
      this.prisma.payrollRun.aggregate({
        where: runWhere,
        _sum: {
          totalGross: true,
          totalBonuses: true,
          totalPenalties: true,
          totalCommissions: true,
          totalNet: true
        }
      }),
      this.prisma.payrollRun.aggregate({
        where: { ...runWhere, status: PayrollRunStatus.PAID },
        _sum: { totalNet: true }
      }),
      this.prisma.payrollLine.aggregate({
        where: {
          deletedAt: null,
          payrollRun: runWhere
        },
        _sum: {
          workedHours: true,
          overtimeHours: true
        }
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          deletedAt: null,
          status: { in: [TimeEntryStatus.DRAFT, TimeEntryStatus.SUBMITTED] },
          ...(this.dateFilter(query) ? { date: this.dateFilter(query) } : {})
        },
        _sum: { totalMinutes: true }
      })
    ]);
    const net = roundMoney(decimalToNumber(runTotals._sum.totalNet));
    const paid = roundMoney(decimalToNumber(paidTotals._sum.totalNet));

    return {
      visible,
      salaryFund: roundMoney(decimalToNumber(salaryFund._sum.baseSalary)),
      accrued: roundMoney(decimalToNumber(runTotals._sum.totalGross)),
      bonuses: roundMoney(decimalToNumber(runTotals._sum.totalBonuses)),
      penalties: roundMoney(decimalToNumber(runTotals._sum.totalPenalties)),
      commissions: roundMoney(decimalToNumber(runTotals._sum.totalCommissions)),
      net,
      paid,
      unpaid: roundMoney(net - paid),
      workedHours: roundQuantity(decimalToNumber(lineTotals._sum.workedHours)),
      overtimeHours: roundQuantity(decimalToNumber(lineTotals._sum.overtimeHours)),
      unapprovedHours: roundQuantity(decimalToNumber(unapprovedEntries._sum.totalMinutes) / 60)
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
    const orderItemWhere: Prisma.OrderItemWhereInput = {
      deletedAt: null,
      order: salesWhere,
      ...this.buildOrderItemCategoryFilter(query)
    };
    const unpaidOrderWhere: Prisma.OrderWhereInput = {
      ...salesWhere,
      paymentStatus: {
        in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID]
      }
    };
    const [orders, invoiceDocuments, unpaidOrders, itemRevenueTotal, orderItems] = await Promise.all([
      this.prisma.order.aggregate({
        where: salesWhere,
        _count: { _all: true },
        _sum: {
          total: true
        }
      }),
      this.prisma.document.count({
        where: {
          deletedAt: null,
          type: DocumentType.INVOICE,
          order: unpaidOrderWhere
        }
      }),
      this.prisma.order.aggregate({
        where: unpaidOrderWhere,
        _sum: {
          total: true,
          paidAmount: true
        }
      }),
      this.prisma.orderItem.aggregate({
        where: orderItemWhere,
        _sum: { total: true }
      }),
      this.prisma.orderItem.findMany({
        where: orderItemWhere,
        select: {
          quantity: true,
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
    const ordersCount = orders._count._all;
    const itemRevenue = roundMoney(decimalToNumber(itemRevenueTotal._sum.total));
    const salesTotal = query.categoryId ? itemRevenue : roundMoney(decimalToNumber(orders._sum.total));
    const costTotal = orderItems.reduce((sum, item) => {
      const purchasePrice = item.variant?.purchasePrice ?? item.product.purchasePrice;

      if (!purchasePrice) {
        return sum;
      }

      return sum + decimalToNumber(item.quantity) * decimalToNumber(purchasePrice);
    }, 0);
    const margin = roundMoney(itemRevenue - costTotal);
    const unpaidTotal = roundMoney(Math.max(0, decimalToNumber(unpaidOrders._sum.total) - decimalToNumber(unpaidOrders._sum.paidAmount)));

    return {
      financeVisible,
      salesTotal,
      averageCheck: ordersCount > 0 ? roundMoney(salesTotal / ordersCount) : 0,
      unpaidInvoices: {
        count: invoiceDocuments,
        total: unpaidTotal
      },
      margin,
      marginRate: salesTotal > 0 ? roundPercent((margin / salesTotal) * 100) : 0
    };
  }

  private async buildProducts(query: AnalyticsQueryDto, financeVisible: boolean) {
    const groupedItems = await this.prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        deletedAt: null,
        order: this.buildSalesOrderWhere(query),
        ...this.buildOrderItemCategoryFilter(query)
      },
      _sum: {
        quantity: true,
        total: true
      },
      _count: { _all: true }
    });
    const topItems = groupedItems
      .sort((a, b) => decimalToNumber(b._sum.quantity) - decimalToNumber(a._sum.quantity))
      .slice(0, 10);
    const productIds = topItems.map((item) => item.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, deletedAt: null },
          select: productSelect
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    return {
      popular: topItems
        .filter((item) => productMap.has(item.productId))
        .map((item) => ({
          product: productMap.get(item.productId)!,
          quantity: roundQuantity(decimalToNumber(item._sum.quantity)),
          ordersCount: item._count._all,
          revenue: financeVisible ? roundMoney(decimalToNumber(item._sum.total)) : null
        }))
    };
  }

  private async buildManagers(query: AnalyticsQueryDto, financeVisible: boolean) {
    const groupedOrders = await this.prisma.order.groupBy({
      by: ["managerId"],
      where: this.buildSalesOrderWhere(query),
      _count: { _all: true },
      _sum: { total: true }
    });
    const managerIds = groupedOrders.flatMap((item) => (item.managerId ? [item.managerId] : []));
    const managers = managerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: managerIds }, deletedAt: null },
          select: managerSelect
        })
      : [];
    const managerMap = new Map(managers.map((manager) => [manager.id, manager]));

    return {
      best: groupedOrders
        .map((item) => ({
          managerId: item.managerId,
          manager: item.managerId ? managerMap.get(item.managerId) ?? null : null,
          ordersCount: item._count._all,
          salesTotal: roundMoney(decimalToNumber(item._sum.total))
        }))
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
    return (await this.getAnalyticsAccess(actorId)).finance;
  }

  private async getAnalyticsAccess(actorId: string) {
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
      return { finance: false, payroll: false };
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));

    if (user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN)) {
      return { finance: true, payroll: true };
    }

    const permissions = new Set(
      user.roles.flatMap(({ role }) =>
        role.deletedAt
          ? []
          : role.permissions
              .filter(({ permission }) => !permission.deletedAt)
              .map(({ permission }) => permission.key)
      )
    );

    return {
      finance: ["payments.read", "analytics.read_finance"].some((permission) => permissions.has(permission)),
      payroll: ["payroll.read", "payroll.manage"].some((permission) => permissions.has(permission))
    };
  }

  private buildPayrollPeriodWhere(query: AnalyticsQueryDto): Prisma.PayrollPeriodWhereInput {
    const dateFrom = query.dateFrom ? startOfDay(new Date(query.dateFrom)) : undefined;
    const dateTo = query.dateTo ? endOfDay(new Date(query.dateTo)) : undefined;

    return {
      deletedAt: null,
      ...(dateFrom || dateTo
        ? {
            dateFrom: dateTo ? { lte: dateTo } : undefined,
            dateTo: dateFrom ? { gte: dateFrom } : undefined
          }
        : {})
    };
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
