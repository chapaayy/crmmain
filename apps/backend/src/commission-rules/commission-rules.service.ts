import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, CommissionSource, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommissionRuleDto, UpdateCommissionRuleDto } from "./dto/commission-rule.dto";
import { CommissionRuleQueryDto } from "./dto/commission-rule-query.dto";

const commissionRuleSelect = {
  id: true,
  employeeId: true,
  roleId: true,
  name: true,
  source: true,
  percent: true,
  minOrderAmount: true,
  productCategoryId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      position: true,
      department: true
    }
  },
  role: {
    select: {
      id: true,
      code: true,
      name: true
    }
  },
  productCategory: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.CommissionRuleSelect;

@Injectable()
export class CommissionRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(query: CommissionRuleQueryDto) {
    const where: Prisma.CommissionRuleWhereInput = {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { employee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { employee: { lastName: { contains: query.search, mode: "insensitive" } } },
              { employee: { employeeNumber: { contains: query.search, mode: "insensitive" } } },
              { role: { name: { contains: query.search, mode: "insensitive" } } },
              { productCategory: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
    const [total, data] = await Promise.all([
      this.prisma.commissionRule.count({ where }),
      this.prisma.commissionRule.findMany({
        where,
        select: commissionRuleSelect,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async create(dto: CreateCommissionRuleDto, actorId: string) {
    await this.ensureReferences(dto.employeeId, dto.roleId, dto.productCategoryId);
    const rule = await this.prisma.commissionRule.create({
      data: {
        employeeId: nullableString(dto.employeeId),
        roleId: nullableString(dto.roleId),
        name: requiredString(dto.name, "Commission rule name"),
        source: dto.source ?? CommissionSource.PAID_ORDERS,
        percent: decimal(dto.percent),
        minOrderAmount: decimalOrUndefined(dto.minOrderAmount),
        productCategoryId: nullableString(dto.productCategoryId),
        isActive: dto.isActive ?? true
      },
      select: commissionRuleSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "CommissionRule",
      entityId: rule.id,
      after: sanitizeJson(rule)
    });

    return { rule };
  }

  async update(id: string, dto: UpdateCommissionRuleDto, actorId: string) {
    const before = await this.requireRule(id);

    await this.ensureReferences(dto.employeeId ?? undefined, dto.roleId ?? undefined, dto.productCategoryId ?? undefined);

    const data: Prisma.CommissionRuleUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "employeeId", dto.employeeId, nullableString);
    assignIfDefined(writable, "roleId", dto.roleId, nullableString);
    assignIfDefined(writable, "name", dto.name, (value) => requiredString(value, "Commission rule name"));
    assignIfDefined(writable, "source", dto.source);
    assignIfDefined(writable, "percent", dto.percent, decimal);
    assignIfDefined(writable, "minOrderAmount", dto.minOrderAmount, decimalOrNull);
    assignIfDefined(writable, "productCategoryId", dto.productCategoryId, nullableString);
    assignIfDefined(writable, "isActive", dto.isActive);

    const rule = await this.prisma.commissionRule.update({
      where: { id },
      data,
      select: commissionRuleSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "CommissionRule",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(rule)
    });

    return { rule };
  }

  async delete(id: string, actorId: string) {
    const before = await this.requireRule(id);

    await this.prisma.commissionRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "CommissionRule",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  private async ensureReferences(employeeId?: string | null, roleId?: string | null, productCategoryId?: string | null) {
    if (employeeId) {
      const employee = await this.prisma.employeeProfile.findFirst({
        where: { id: employeeId, deletedAt: null },
        select: { id: true }
      });

      if (!employee) {
        throw new BadRequestException("Employee not found");
      }
    }

    if (roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: roleId, deletedAt: null },
        select: { id: true }
      });

      if (!role) {
        throw new BadRequestException("Role not found");
      }
    }

    if (productCategoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: productCategoryId, deletedAt: null },
        select: { id: true }
      });

      if (!category) {
        throw new BadRequestException("Product category not found");
      }
    }
  }

  private async requireRule(id: string) {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { id, deletedAt: null },
      select: commissionRuleSelect
    });

    if (!rule) {
      throw new NotFoundException("Commission rule not found");
    }

    return rule;
  }
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
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

function decimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value);
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

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
