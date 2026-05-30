import { Injectable } from "@nestjs/common";
import { PayrollRunStatus, Prisma, RoleCode, TaskStatus, TimeEntryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

const productSelect = {
  id: true,
  sku: true,
  name: true,
  categoryId: true,
  minOrderQty: true
} satisfies Prisma.ProductSelect;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(query: AnalyticsQueryDto, actorId: string) {
    const access = await this.getAnalyticsAccess(actorId);
    const [employees, tasks, products, warehouse, payroll] = await Promise.all([
      this.employees(query),
      this.tasks(query),
      this.products(query),
      this.warehouse(query),
      this.payroll(query, access.payroll)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters: this.normalizeFilters(query),
      employees,
      tasks,
      products,
      warehouse,
      payroll
    };
  }

  async employees(query: AnalyticsQueryDto) {
    const employeeWhere: Prisma.EmployeeProfileWhereInput = {
      deletedAt: null
    };
    const userWhere: Prisma.UserWhereInput = {
      deletedAt: null
    };

    if (query.managerId) {
      employeeWhere.userId = query.managerId;
      userWhere.id = query.managerId;
    }

    const [total, active, attendanceAggregate, unreadNotifications] = await Promise.all([
      this.prisma.employeeProfile.count({ where: employeeWhere }),
      this.prisma.employeeProfile.count({ where: { ...employeeWhere, isActive: true } }),
      this.prisma.timeEntry.aggregate({
        where: {
          deletedAt: null,
          status: TimeEntryStatus.APPROVED,
          ...(this.dateFilter(query) ? { date: this.dateFilter(query) } : {})
        },
        _sum: { totalMinutes: true }
      }),
      this.prisma.notification.count({
        where: {
          user: userWhere,
          readAt: null,
          deletedAt: null
        }
      })
    ]);

    return {
      total,
      active,
      inactive: Math.max(0, total - active),
      workedHours: roundQuantity(decimalToNumber(attendanceAggregate._sum.totalMinutes) / 60),
      unreadNotifications
    };
  }

  async tasks(query: AnalyticsQueryDto) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(query.managerId ? { assignedToId: query.managerId } : {})
    };
    const [total, overdue, byStatusRaw] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: {
          ...where,
          dueAt: { lt: new Date() },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        }
      }),
      this.prisma.task.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      })
    ]);

    return {
      total,
      overdue,
      byStatus: Object.values(TaskStatus).map((status) => ({
        status,
        count: byStatusRaw.find((item) => item.status === status)?._count._all ?? 0
      }))
    };
  }

  async products(query: AnalyticsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {})
    };

    const [total, active, categories, lowStockCandidates] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: { ...where, isActive: true } }),
      this.prisma.productCategory.count({ where: { deletedAt: null } }),
      this.prisma.stockItem.findMany({
        where: {
          deletedAt: null,
          ...(query.categoryId
            ? {
                product: {
                  categoryId: query.categoryId
                }
              }
            : {})
        },
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
      })
    ]);

    const lowStock = lowStockCandidates
      .map((item) => {
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

    return {
      total,
      active,
      inactive: Math.max(0, total - active),
      categories,
      lowStock
    };
  }

  async warehouse(query: AnalyticsQueryDto) {
    const stockWhere: Prisma.StockItemWhereInput = {
      deletedAt: null,
      ...(query.categoryId
        ? {
            product: {
              categoryId: query.categoryId
            }
          }
        : {})
    };

    const [warehousesTotal, warehousesActive, stockAggregate, lowStockCandidates, movementsToday] = await Promise.all([
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
      this.prisma.stockMovement.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date())
          },
          ...(query.categoryId
            ? {
                product: {
                  categoryId: query.categoryId
                }
              }
            : {})
        }
      })
    ]);

    const lowStock = lowStockCandidates
      .map((item) => {
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
      movementsToday
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
      net,
      paid,
      unpaid: roundMoney(net - paid),
      workedHours: roundQuantity(decimalToNumber(lineTotals._sum.workedHours)),
      overtimeHours: roundQuantity(decimalToNumber(lineTotals._sum.overtimeHours)),
      unapprovedHours: roundQuantity(decimalToNumber(unapprovedEntries._sum.totalMinutes) / 60)
    };
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
      return { payroll: false };
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));

    if (user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN)) {
      return { payroll: true };
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

  private normalizeFilters(query: AnalyticsQueryDto) {
    return {
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      managerId: query.managerId ?? null,
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
