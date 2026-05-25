import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, EmploymentType, Prisma, WorkScheduleType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDto, CreateWorkScheduleDto, UpdateEmployeeDto, UpdateWorkScheduleDto } from "./dto/employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

const userSummarySelect = {
  id: true,
  email: true,
  name: true,
  primaryRole: true,
  isActive: true
} satisfies Prisma.UserSelect;

const employeeListSelect = {
  id: true,
  userId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  middleName: true,
  phone: true,
  email: true,
  position: true,
  department: true,
  employmentType: true,
  hireDate: true,
  fireDate: true,
  baseSalary: true,
  hourlyRate: true,
  shiftRate: true,
  commissionRate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: userSummarySelect
  },
  _count: {
    select: {
      timeEntries: true,
      shifts: true,
      payrollLines: true
    }
  }
} satisfies Prisma.EmployeeProfileSelect;

const employeeDetailSelect = {
  ...employeeListSelect,
  schedules: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" as const }
  },
  payrollLines: {
    where: { deletedAt: null },
    select: {
      id: true,
      netAmount: true,
      grossAmount: true,
      workedHours: true,
      createdAt: true,
      payrollRun: {
        select: {
          id: true,
          status: true,
          period: {
            select: {
              id: true,
              name: true,
              dateFrom: true,
              dateTo: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" as const },
    take: 10
  }
} satisfies Prisma.EmployeeProfileSelect;

type EmployeePayload = Prisma.EmployeeProfileGetPayload<{ select: typeof employeeDetailSelect }>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(query: EmployeeQueryDto) {
    const where = this.buildWhere(query);
    const [total, employees] = await Promise.all([
      this.prisma.employeeProfile.count({ where }),
      this.prisma.employeeProfile.findMany({
        where,
        select: employeeListSelect,
        orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: employees,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateEmployeeDto, actorId: string) {
    await this.requireUser(dto.userId);

    const employee = await this.prisma.employeeProfile
      .create({
        data: this.toCreateData(dto),
        select: employeeDetailSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Employee number or user link already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "EmployeeProfile",
      entityId: employee.id,
      after: sanitizeJson(employee)
    });

    return { employee };
  }

  async get(id: string) {
    return { employee: await this.requireEmployee(id) };
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId: string) {
    const before = await this.requireEmployee(id);

    if (dto.userId) {
      await this.requireUser(dto.userId);
    }

    const employee = await this.prisma.employeeProfile
      .update({
        where: { id },
        data: this.toUpdateData(dto),
        select: employeeDetailSelect
      })
      .catch((error: unknown) => {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException("Employee number or user link already exists");
        }

        throw error;
      });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "EmployeeProfile",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(employee)
    });

    return { employee };
  }

  async delete(id: string, actorId: string) {
    const before = await this.requireEmployee(id);

    await this.prisma.employeeProfile.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "EmployeeProfile",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async listSchedules(employeeId: string) {
    await this.requireEmployee(employeeId);
    const schedules = await this.prisma.workSchedule.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });

    return { schedules };
  }

  async createSchedule(employeeId: string, dto: CreateWorkScheduleDto, actorId: string) {
    await this.requireEmployee(employeeId);
    const schedule = await this.prisma.workSchedule.create({
      data: {
        employeeId,
        name: requiredString(dto.name, "Schedule name"),
        type: dto.type ?? WorkScheduleType.FIVE_TWO,
        workdayHours: money(dto.workdayHours ?? 8),
        startsAt: optionalDate(dto.startsAt),
        endsAt: optionalDate(dto.endsAt),
        timezone: nullableString(dto.timezone) ?? process.env.PAYROLL_TIMEZONE ?? "Europe/Berlin",
        isActive: dto.isActive ?? true
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "WorkSchedule",
      entityId: schedule.id,
      after: sanitizeJson(schedule)
    });

    return { schedule };
  }

  async updateSchedule(id: string, dto: UpdateWorkScheduleDto, actorId: string) {
    const before = await this.requireSchedule(id);
    const data: Prisma.WorkScheduleUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "name", dto.name, (value) => requiredString(value, "Schedule name"));
    assignIfDefined(writable, "type", dto.type);
    assignIfDefined(writable, "workdayHours", dto.workdayHours, money);
    assignIfDefined(writable, "startsAt", dto.startsAt, nullableDate);
    assignIfDefined(writable, "endsAt", dto.endsAt, nullableDate);
    assignIfDefined(writable, "timezone", dto.timezone, (value) => nullableString(value) ?? "Europe/Berlin");
    assignIfDefined(writable, "isActive", dto.isActive);

    const schedule = await this.prisma.workSchedule.update({
      where: { id },
      data
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "WorkSchedule",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(schedule)
    });

    return { schedule };
  }

  async deleteSchedule(id: string, actorId: string) {
    const before = await this.requireSchedule(id);

    await this.prisma.workSchedule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "WorkSchedule",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  private buildWhere(query: EmployeeQueryDto): Prisma.EmployeeProfileWhereInput {
    return {
      deletedAt: null,
      ...(query.department ? { department: { contains: query.department, mode: "insensitive" } } : {}),
      ...(query.position ? { position: { contains: query.position, mode: "insensitive" } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeNumber: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { middleName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { position: { contains: query.search, mode: "insensitive" } },
              { department: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { user: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async requireEmployee(id: string): Promise<EmployeePayload> {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, deletedAt: null },
      select: employeeDetailSelect
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return employee;
  }

  private async requireSchedule(id: string) {
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { id, deletedAt: null }
    });

    if (!schedule) {
      throw new NotFoundException("Work schedule not found");
    }

    return schedule;
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true }
    });

    if (!user) {
      throw new BadRequestException("Linked user not found or inactive");
    }
  }

  private toCreateData(dto: CreateEmployeeDto): Prisma.EmployeeProfileUncheckedCreateInput {
    return {
      userId: dto.userId,
      employeeNumber: requiredString(dto.employeeNumber, "Employee number"),
      firstName: requiredString(dto.firstName, "First name"),
      lastName: requiredString(dto.lastName, "Last name"),
      middleName: nullableString(dto.middleName),
      phone: nullableString(dto.phone),
      email: nullableString(dto.email),
      position: nullableString(dto.position),
      department: nullableString(dto.department),
      employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
      hireDate: optionalDate(dto.hireDate),
      fireDate: optionalDate(dto.fireDate),
      baseSalary: decimalOrUndefined(dto.baseSalary),
      hourlyRate: decimalOrUndefined(dto.hourlyRate),
      shiftRate: decimalOrUndefined(dto.shiftRate),
      commissionRate: decimalOrUndefined(dto.commissionRate),
      isActive: dto.isActive ?? true
    };
  }

  private toUpdateData(dto: UpdateEmployeeDto): Prisma.EmployeeProfileUncheckedUpdateInput {
    const data: Prisma.EmployeeProfileUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "userId", dto.userId);
    assignIfDefined(writable, "employeeNumber", dto.employeeNumber, (value) => requiredString(value, "Employee number"));
    assignIfDefined(writable, "firstName", dto.firstName, (value) => requiredString(value, "First name"));
    assignIfDefined(writable, "lastName", dto.lastName, (value) => requiredString(value, "Last name"));
    assignIfDefined(writable, "middleName", dto.middleName, nullableString);
    assignIfDefined(writable, "phone", dto.phone, nullableString);
    assignIfDefined(writable, "email", dto.email, nullableString);
    assignIfDefined(writable, "position", dto.position, nullableString);
    assignIfDefined(writable, "department", dto.department, nullableString);
    assignIfDefined(writable, "employmentType", dto.employmentType);
    assignIfDefined(writable, "hireDate", dto.hireDate, nullableDate);
    assignIfDefined(writable, "fireDate", dto.fireDate, nullableDate);
    assignIfDefined(writable, "baseSalary", dto.baseSalary, decimalOrNull);
    assignIfDefined(writable, "hourlyRate", dto.hourlyRate, decimalOrNull);
    assignIfDefined(writable, "shiftRate", dto.shiftRate, decimalOrNull);
    assignIfDefined(writable, "commissionRate", dto.commissionRate, decimalOrNull);
    assignIfDefined(writable, "isActive", dto.isActive);

    return data;
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

function optionalDate(value: string | null | undefined) {
  return value ? new Date(value) : undefined;
}

function nullableDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
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

function money(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}
