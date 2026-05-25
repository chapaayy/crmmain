import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  CommissionSource,
  OrderStatus,
  PayrollAdjustmentType,
  PayrollPeriodStatus,
  PayrollRunStatus,
  Prisma,
  TimeEntryStatus,
  WorkShiftStatus
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePayrollAdjustmentDto, CreatePayrollPeriodDto, CreatePayrollRunDto, UpdatePayrollAdjustmentDto, UpdatePayrollPeriodDto } from "./dto/payroll.dto";
import { PayrollAdjustmentQueryDto, PayrollPeriodQueryDto, PayrollRunQueryDto } from "./dto/payroll-query.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

const employeeSummarySelect = {
  id: true,
  userId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  position: true,
  department: true
} satisfies Prisma.EmployeeProfileSelect;

const periodSelect = {
  id: true,
  name: true,
  dateFrom: true,
  dateTo: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PayrollPeriodSelect;

const runListSelect = {
  id: true,
  periodId: true,
  calculatedById: true,
  approvedById: true,
  calculatedAt: true,
  approvedAt: true,
  status: true,
  totalGross: true,
  totalBonuses: true,
  totalPenalties: true,
  totalCommissions: true,
  totalNet: true,
  createdAt: true,
  updatedAt: true,
  period: {
    select: periodSelect
  },
  calculatedBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  },
  approvedBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  },
  _count: {
    select: {
      lines: true
    }
  }
} satisfies Prisma.PayrollRunSelect;

const runDetailSelect = {
  ...runListSelect,
  lines: {
    where: { deletedAt: null },
    select: {
      id: true,
      payrollRunId: true,
      employeeId: true,
      baseSalaryAmount: true,
      hourlyAmount: true,
      shiftAmount: true,
      overtimeAmount: true,
      bonusAmount: true,
      penaltyAmount: true,
      commissionAmount: true,
      grossAmount: true,
      netAmount: true,
      workedHours: true,
      workedDays: true,
      overtimeHours: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: employeeSummarySelect
      }
    },
    orderBy: [{ employee: { lastName: "asc" as const } }, { employee: { firstName: "asc" as const } }]
  }
} satisfies Prisma.PayrollRunSelect;

const adjustmentSelect = {
  id: true,
  employeeId: true,
  periodId: true,
  type: true,
  amount: true,
  reason: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: employeeSummarySelect
  },
  period: {
    select: periodSelect
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  }
} satisfies Prisma.PayrollAdjustmentSelect;

const payrollEmployeeSelect = {
  id: true,
  userId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  baseSalary: true,
  hourlyRate: true,
  shiftRate: true,
  commissionRate: true,
  user: {
    select: {
      roles: {
        where: { deletedAt: null },
        select: {
          roleId: true,
          role: {
            select: {
              deletedAt: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.EmployeeProfileSelect;

type PayrollEmployee = Prisma.EmployeeProfileGetPayload<{ select: typeof payrollEmployeeSelect }>;
type PayrollRunPayload = Prisma.PayrollRunGetPayload<{ select: typeof runDetailSelect }>;

const lockedRunStatuses: PayrollRunStatus[] = [PayrollRunStatus.APPROVED, PayrollRunStatus.PAID];
const payableRunStatuses: PayrollRunStatus[] = [PayrollRunStatus.APPROVED, PayrollRunStatus.PAID];
const lockedPeriodStatuses: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.APPROVED,
  PayrollPeriodStatus.PAID,
  PayrollPeriodStatus.CLOSED
];

interface CommissionRuleConfig {
  source: CommissionSource;
  percent: Prisma.Decimal | number | string;
  minOrderAmount?: Prisma.Decimal | number | string | null;
  productCategoryId?: string | null;
}

interface PayrollLineCalculation {
  baseSalaryAmount: number;
  hourlyAmount: number;
  shiftAmount: number;
  overtimeAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  commissionAmount: number;
  grossAmount: number;
  netAmount: number;
  workedHours: number;
  workedDays: number;
  overtimeHours: number;
  comment: string | null;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService
  ) {}

  async listPeriods(query: PayrollPeriodQueryDto) {
    const where = this.buildPeriodWhere(query);
    const [total, data] = await Promise.all([
      this.prisma.payrollPeriod.count({ where }),
      this.prisma.payrollPeriod.findMany({
        where,
        select: periodSelect,
        orderBy: { dateFrom: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async createPeriod(dto: CreatePayrollPeriodDto, actorId: string) {
    const dateFrom = startOfDay(new Date(dto.dateFrom));
    const dateTo = endOfDay(new Date(dto.dateTo));

    if (dateFrom > dateTo) {
      throw new BadRequestException("dateFrom must be before dateTo");
    }

    const period = await this.prisma.payrollPeriod.create({
      data: {
        name: requiredString(dto.name, "Payroll period name"),
        dateFrom,
        dateTo,
        status: dto.status ?? PayrollPeriodStatus.OPEN
      },
      select: periodSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "PayrollPeriod",
      entityId: period.id,
      after: sanitizeJson(period)
    });

    return { period };
  }

  async updatePeriod(id: string, dto: UpdatePayrollPeriodDto, actorId: string) {
    const before = await this.requirePeriod(this.prisma, id);
    const data: Prisma.PayrollPeriodUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "name", dto.name, (value) => requiredString(value, "Payroll period name"));
    assignIfDefined(writable, "dateFrom", dto.dateFrom, (value) => startOfDay(new Date(value)));
    assignIfDefined(writable, "dateTo", dto.dateTo, (value) => endOfDay(new Date(value)));
    assignIfDefined(writable, "status", dto.status);

    const period = await this.prisma.payrollPeriod.update({
      where: { id },
      data,
      select: periodSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "PayrollPeriod",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(period)
    });

    return { period };
  }

  async listRuns(query: PayrollRunQueryDto) {
    const where: Prisma.PayrollRunWhereInput = {
      deletedAt: null,
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { period: { name: { contains: query.search, mode: "insensitive" } } } : {})
    };
    const [total, data] = await Promise.all([
      this.prisma.payrollRun.count({ where }),
      this.prisma.payrollRun.findMany({
        where,
        select: runListSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async createRun(dto: CreatePayrollRunDto, actorId: string) {
    await this.requirePeriod(this.prisma, dto.periodId);
    const run = await this.prisma.payrollRun.create({
      data: {
        periodId: dto.periodId,
        calculatedById: actorId,
        status: PayrollRunStatus.DRAFT
      },
      select: runDetailSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "PayrollRun",
      entityId: run.id,
      after: sanitizeJson(run)
    });

    return { run };
  }

  async getRun(id: string) {
    return { run: await this.requireRun(this.prisma, id) };
  }

  async calculateRun(id: string, actorId: string) {
    const run = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, id);

      if (lockedRunStatuses.includes(before.status)) {
        throw new BadRequestException("Approved or paid payroll run cannot be recalculated");
      }

      const period = before.period;
      const employees = await tx.employeeProfile.findMany({
        where: { deletedAt: null, isActive: true },
        select: payrollEmployeeSelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      const totals = {
        totalGross: 0,
        totalBonuses: 0,
        totalPenalties: 0,
        totalCommissions: 0,
        totalNet: 0
      };
      const activeEmployeeIds = new Set<string>();

      for (const employee of employees) {
        activeEmployeeIds.add(employee.id);
        const line = await this.calculateEmployeeLine(tx, employee, period);

        totals.totalGross = roundMoney(totals.totalGross + line.grossAmount);
        totals.totalBonuses = roundMoney(totals.totalBonuses + line.bonusAmount);
        totals.totalPenalties = roundMoney(totals.totalPenalties + line.penaltyAmount);
        totals.totalCommissions = roundMoney(totals.totalCommissions + line.commissionAmount);
        totals.totalNet = roundMoney(totals.totalNet + line.netAmount);

        await tx.payrollLine.upsert({
          where: {
            payrollRunId_employeeId: {
              payrollRunId: id,
              employeeId: employee.id
            }
          },
          update: {
            ...toPayrollLineData(line),
            deletedAt: null
          },
          create: {
            payrollRunId: id,
            employeeId: employee.id,
            ...toPayrollLineData(line)
          }
        });
      }

      await tx.payrollLine.updateMany({
        where: {
          payrollRunId: id,
          employeeId: { notIn: Array.from(activeEmployeeIds) },
          deletedAt: null
        },
        data: { deletedAt: new Date() }
      });
      await tx.payrollRun.update({
        where: { id },
        data: {
          calculatedById: actorId,
          calculatedAt: new Date(),
          approvedById: null,
          approvedAt: null,
          status: PayrollRunStatus.CALCULATED,
          totalGross: money(totals.totalGross),
          totalBonuses: money(totals.totalBonuses),
          totalPenalties: money(totals.totalPenalties),
          totalCommissions: money(totals.totalCommissions),
          totalNet: money(totals.totalNet)
        }
      });
      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { status: PayrollPeriodStatus.CALCULATED }
      });

      const after = await this.requireRun(tx, id);
      await this.auditTx(tx, actorId, AuditAction.UPDATE, "PayrollRunCalculate", id, before, after);

      return after;
    });

    return { run };
  }

  async approveRun(id: string, actorId: string) {
    const run = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, id);

      if (before.status !== PayrollRunStatus.CALCULATED) {
        throw new BadRequestException("Only calculated payroll run can be approved");
      }

      await tx.payrollRun.update({
        where: { id },
        data: {
          status: PayrollRunStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date()
        }
      });
      await tx.payrollPeriod.update({
        where: { id: before.periodId },
        data: { status: PayrollPeriodStatus.APPROVED }
      });
      const after = await this.requireRun(tx, id);
      await this.auditTx(tx, actorId, AuditAction.UPDATE, "PayrollRunApprove", id, before, after);

      return after;
    });

    return { run };
  }

  async markRunPaid(id: string, actorId: string) {
    const run = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, id);

      if (!payableRunStatuses.includes(before.status)) {
        throw new BadRequestException("Only approved payroll run can be marked as paid");
      }

      await tx.payrollRun.update({
        where: { id },
        data: { status: PayrollRunStatus.PAID }
      });
      await tx.payrollPeriod.update({
        where: { id: before.periodId },
        data: { status: PayrollPeriodStatus.PAID }
      });
      const after = await this.requireRun(tx, id);
      await this.auditTx(tx, actorId, AuditAction.UPDATE, "PayrollRunPaid", id, before, after);

      return after;
    });

    return { run };
  }

  async cancelRun(id: string, actorId: string) {
    const run = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, id);

      if (before.status === PayrollRunStatus.PAID) {
        throw new BadRequestException("Paid payroll run cannot be cancelled");
      }

      await tx.payrollRun.update({
        where: { id },
        data: {
          status: PayrollRunStatus.CANCELLED,
          approvedById: null,
          approvedAt: null
        }
      });
      const after = await this.requireRun(tx, id);
      await this.auditTx(tx, actorId, AuditAction.UPDATE, "PayrollRunCancel", id, before, after);

      return after;
    });

    return { run };
  }

  async exportRun(id: string, actorId: string) {
    const run = await this.requireRun(this.prisma, id);
    const rows = run.lines.map((line) => [
      line.employee.employeeNumber,
      `${line.employee.lastName} ${line.employee.firstName}`,
      line.employee.department,
      line.employee.position,
      line.workedHours,
      line.overtimeHours,
      line.baseSalaryAmount,
      line.hourlyAmount,
      line.shiftAmount,
      line.overtimeAmount,
      line.bonusAmount,
      line.penaltyAmount,
      line.commissionAmount,
      line.grossAmount,
      line.netAmount
    ]);

    await this.auditService.log({
      actorId,
      action: AuditAction.EXPORT,
      entityType: "PayrollRunExport",
      entityId: id,
      after: sanitizeJson({ rows: rows.length })
    });

    return [
      "employeeNumber,employee,department,position,workedHours,overtimeHours,baseSalary,hourly,shift,overtime,bonuses,penalties,commissions,gross,net",
      ...rows.map((row) => row.map(csvEscape).join(","))
    ].join("\n");
  }

  async listAdjustments(query: PayrollAdjustmentQueryDto) {
    const where: Prisma.PayrollAdjustmentWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.search
        ? {
            OR: [
              { reason: { contains: query.search, mode: "insensitive" } },
              { employee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { employee: { lastName: { contains: query.search, mode: "insensitive" } } },
              { employee: { employeeNumber: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
    const [total, data] = await Promise.all([
      this.prisma.payrollAdjustment.count({ where }),
      this.prisma.payrollAdjustment.findMany({
        where,
        select: adjustmentSelect,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async createAdjustment(dto: CreatePayrollAdjustmentDto, actorId: string) {
    await Promise.all([
      this.requireEmployee(dto.employeeId),
      this.requireEditablePeriod(dto.periodId)
    ]);
    const adjustment = await this.prisma.payrollAdjustment.create({
      data: {
        employeeId: dto.employeeId,
        periodId: dto.periodId,
        type: dto.type,
        amount: money(dto.amount),
        reason: requiredString(dto.reason, "Reason"),
        createdById: actorId
      },
      select: adjustmentSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "PayrollAdjustment",
      entityId: adjustment.id,
      after: sanitizeJson(adjustment)
    });

    return { adjustment };
  }

  async updateAdjustment(id: string, dto: UpdatePayrollAdjustmentDto, actorId: string) {
    const before = await this.requireAdjustment(id);
    const periodId = dto.periodId ?? before.periodId;

    await this.requireEditablePeriod(periodId);

    if (dto.employeeId) {
      await this.requireEmployee(dto.employeeId);
    }

    const data: Prisma.PayrollAdjustmentUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "employeeId", dto.employeeId);
    assignIfDefined(writable, "periodId", dto.periodId);
    assignIfDefined(writable, "type", dto.type);
    assignIfDefined(writable, "amount", dto.amount, money);
    assignIfDefined(writable, "reason", dto.reason, (value) => requiredString(value, "Reason"));

    const adjustment = await this.prisma.payrollAdjustment.update({
      where: { id },
      data,
      select: adjustmentSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "PayrollAdjustment",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(adjustment)
    });

    return { adjustment };
  }

  async deleteAdjustment(id: string, actorId: string) {
    const before = await this.requireAdjustment(id);

    await this.requireEditablePeriod(before.periodId);
    await this.prisma.payrollAdjustment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "PayrollAdjustment",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  private buildPeriodWhere(query: PayrollPeriodQueryDto): Prisma.PayrollPeriodWhereInput {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo ? { dateFrom: dateRange(query.dateFrom, query.dateTo) } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {})
    };
  }

  private async calculateEmployeeLine(
    tx: Prisma.TransactionClient,
    employee: PayrollEmployee,
    period: PayrollRunPayload["period"]
  ): Promise<PayrollLineCalculation> {
    const [minutesAggregate, workedShifts, adjustments] = await Promise.all([
      tx.timeEntry.aggregate({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: TimeEntryStatus.APPROVED,
          date: { gte: period.dateFrom, lte: period.dateTo }
        },
        _sum: { totalMinutes: true }
      }),
      tx.workShift.count({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: WorkShiftStatus.WORKED,
          date: { gte: period.dateFrom, lte: period.dateTo }
        }
      }),
      tx.payrollAdjustment.findMany({
        where: {
          employeeId: employee.id,
          periodId: period.id,
          deletedAt: null
        },
        select: {
          type: true,
          amount: true
        }
      })
    ]);
    const workedHours = roundHours((minutesAggregate._sum.totalMinutes ?? 0) / 60);
    const normHours = businessDays(period.dateFrom, period.dateTo) * this.config.get<number>("payroll.defaultWorkdayHours", 8);
    const hourlyRate = decimalToNumber(employee.hourlyRate);
    const regularHours = hourlyRate > 0 ? Math.min(workedHours, normHours) : 0;
    const overtimeHours = hourlyRate > 0 ? Math.max(0, workedHours - normHours) : 0;
    const baseSalaryAmount = decimalToNumber(employee.baseSalary);
    const hourlyAmount = roundMoney(regularHours * hourlyRate);
    const shiftAmount = roundMoney(workedShifts * decimalToNumber(employee.shiftRate));
    const overtimeAmount = roundMoney(
      overtimeHours * hourlyRate * this.config.get<number>("payroll.overtimeMultiplier", 1.5)
    );
    const bonusAmount = roundMoney(
      adjustments
        .filter((adjustment) => adjustment.type === PayrollAdjustmentType.BONUS || (adjustment.type === PayrollAdjustmentType.CORRECTION && decimalToNumber(adjustment.amount) > 0))
        .reduce((sum, adjustment) => sum + Math.max(0, decimalToNumber(adjustment.amount)), 0)
    );
    const penaltyAmount = roundMoney(
      adjustments
        .filter((adjustment) => adjustment.type === PayrollAdjustmentType.PENALTY || (adjustment.type === PayrollAdjustmentType.CORRECTION && decimalToNumber(adjustment.amount) < 0))
        .reduce((sum, adjustment) => sum + Math.abs(decimalToNumber(adjustment.amount)), 0)
    );
    const commissionAmount = await this.calculateCommission(tx, employee, period);
    const grossAmount = roundMoney(baseSalaryAmount + hourlyAmount + shiftAmount + overtimeAmount + bonusAmount + commissionAmount);
    const netAmount = roundMoney(Math.max(0, grossAmount - penaltyAmount));

    return {
      baseSalaryAmount,
      hourlyAmount,
      shiftAmount,
      overtimeAmount,
      bonusAmount,
      penaltyAmount,
      commissionAmount,
      grossAmount,
      netAmount,
      workedHours,
      workedDays: workedShifts,
      overtimeHours,
      comment: null as string | null
    };
  }

  private async calculateCommission(tx: Prisma.TransactionClient, employee: PayrollEmployee, period: PayrollRunPayload["period"]) {
    if (!this.config.get<boolean>("payroll.enableSalesCommission", true)) {
      return 0;
    }

    const roleIds = employee.user.roles.filter(({ role }) => !role.deletedAt).map(({ roleId }) => roleId);
    const rules = await tx.commissionRule.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { employeeId: employee.id },
          ...(roleIds.length ? [{ roleId: { in: roleIds } }] : [])
        ]
      },
      select: {
        source: true,
        percent: true,
        minOrderAmount: true,
        productCategoryId: true
      }
    });
    const effectiveRules: CommissionRuleConfig[] =
      rules.length > 0
        ? rules
        : employee.commissionRate
          ? [{ source: CommissionSource.PAID_ORDERS, percent: employee.commissionRate }]
          : [];
    let total = 0;

    for (const rule of effectiveRules) {
      const base = await this.commissionBaseForRule(tx, employee.userId, period, rule);
      total = roundMoney(total + (base * decimalToNumber(rule.percent)) / 100);
    }

    return total;
  }

  private async commissionBaseForRule(
    tx: Prisma.TransactionClient,
    managerId: string,
    period: PayrollRunPayload["period"],
    rule: CommissionRuleConfig
  ) {
    const statuses = commissionStatuses(rule.source);
    const orderWhere: Prisma.OrderWhereInput = {
      deletedAt: null,
      managerId,
      status: { in: statuses },
      createdAt: { gte: period.dateFrom, lte: period.dateTo },
      ...(rule.minOrderAmount ? { total: { gte: money(decimalToNumber(rule.minOrderAmount)) } } : {})
    };

    if (rule.productCategoryId || rule.source === CommissionSource.PROFIT) {
      const items = await tx.orderItem.findMany({
        where: {
          deletedAt: null,
          order: orderWhere,
          ...(rule.productCategoryId
            ? {
                OR: [
                  { product: { categoryId: rule.productCategoryId } },
                  { variant: { categoryId: rule.productCategoryId } }
                ]
              }
            : {})
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
      });

      return roundMoney(
        items.reduce((sum, item) => {
          const revenue = decimalToNumber(item.total);

          if (rule.source !== CommissionSource.PROFIT) {
            return sum + revenue;
          }

          const purchasePrice = item.variant?.purchasePrice ?? item.product.purchasePrice;
          const cost = purchasePrice ? decimalToNumber(item.quantity) * decimalToNumber(purchasePrice) : 0;

          return sum + Math.max(0, revenue - cost);
        }, 0)
      );
    }

    const orders = await tx.order.findMany({
      where: orderWhere,
      select: { total: true }
    });

    return roundMoney(orders.reduce((sum, order) => sum + decimalToNumber(order.total), 0));
  }

  private async requirePeriod(client: DbClient, id: string) {
    const period = await client.payrollPeriod.findFirst({
      where: { id, deletedAt: null },
      select: periodSelect
    });

    if (!period) {
      throw new NotFoundException("Payroll period not found");
    }

    return period;
  }

  private async requireEditablePeriod(id: string) {
    const period = await this.requirePeriod(this.prisma, id);

    if (lockedPeriodStatuses.includes(period.status)) {
      throw new BadRequestException("Approved payroll period cannot be edited");
    }

    return period;
  }

  private async requireRun(client: DbClient, id: string): Promise<PayrollRunPayload> {
    const run = await client.payrollRun.findFirst({
      where: { id, deletedAt: null },
      select: runDetailSelect
    });

    if (!run) {
      throw new NotFoundException("Payroll run not found");
    }

    return run;
  }

  private async requireEmployee(id: string) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!employee) {
      throw new BadRequestException("Employee not found");
    }
  }

  private async requireAdjustment(id: string) {
    const adjustment = await this.prisma.payrollAdjustment.findFirst({
      where: { id, deletedAt: null },
      select: adjustmentSelect
    });

    if (!adjustment) {
      throw new NotFoundException("Payroll adjustment not found");
    }

    return adjustment;
  }

  private auditTx(
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
}

function toPayrollLineData(line: PayrollLineCalculation) {
  return {
    baseSalaryAmount: money(line.baseSalaryAmount),
    hourlyAmount: money(line.hourlyAmount),
    shiftAmount: money(line.shiftAmount),
    overtimeAmount: money(line.overtimeAmount),
    bonusAmount: money(line.bonusAmount),
    penaltyAmount: money(line.penaltyAmount),
    commissionAmount: money(line.commissionAmount),
    grossAmount: money(line.grossAmount),
    netAmount: money(line.netAmount),
    workedHours: quantityDecimal(line.workedHours),
    workedDays: quantityDecimal(line.workedDays),
    overtimeHours: quantityDecimal(line.overtimeHours),
    comment: line.comment
  };
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function commissionStatuses(source: CommissionSource): OrderStatus[] {
  if (source === CommissionSource.COMPLETED_ORDERS) {
    return [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
  }

  return [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED];
}

function businessDays(dateFrom: Date, dateTo: Date) {
  let days = 0;
  const current = startOfDay(dateFrom);
  const end = startOfDay(dateTo);

  while (current <= end) {
    const day = current.getDay();

    if (day !== 0 && day !== 6) {
      days += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function dateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter {
  return {
    ...(dateFrom ? { gte: startOfDay(new Date(dateFrom)) } : {}),
    ...(dateTo ? { lte: endOfDay(new Date(dateTo)) } : {})
  };
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

function money(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(roundMoney(decimalToNumber(value)));
}

function quantityDecimal(value: number) {
  return new Prisma.Decimal(roundHours(value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundHours(value: number) {
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
