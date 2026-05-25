import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleCode, TimeEntrySource, TimeEntryStatus, WorkShiftStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTimeEntryDto, CreateWorkShiftDto, RejectTimeEntryDto, UpdateTimeEntryDto, UpdateWorkShiftDto } from "./dto/attendance.dto";
import { TimeEntryQueryDto, WorkShiftQueryDto } from "./dto/attendance-query.dto";

const employeeSummarySelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  position: true,
  department: true,
  userId: true
} satisfies Prisma.EmployeeProfileSelect;

const timeEntrySelect = {
  id: true,
  employeeId: true,
  date: true,
  startedAt: true,
  endedAt: true,
  breakMinutes: true,
  totalMinutes: true,
  source: true,
  approvedById: true,
  approvedAt: true,
  status: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: employeeSummarySelect
  },
  approvedBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  }
} satisfies Prisma.TimeEntrySelect;

const workShiftSelect = {
  id: true,
  employeeId: true,
  scheduleId: true,
  date: true,
  plannedStart: true,
  plannedEnd: true,
  actualStart: true,
  actualEnd: true,
  status: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: employeeSummarySelect
  },
  schedule: {
    select: {
      id: true,
      name: true,
      type: true,
      timezone: true
    }
  }
} satisfies Prisma.WorkShiftSelect;

type TimeEntryPayload = Prisma.TimeEntryGetPayload<{ select: typeof timeEntrySelect }>;

interface ActorAccess {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  employeeId?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listShifts(query: WorkShiftQueryDto) {
    const where = this.buildShiftWhere(query);
    const [total, shifts] = await Promise.all([
      this.prisma.workShift.count({ where }),
      this.prisma.workShift.findMany({
        where,
        select: workShiftSelect,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: shifts,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async createShift(dto: CreateWorkShiftDto, actorId: string) {
    await this.requireEmployee(dto.employeeId);

    if (dto.scheduleId) {
      await this.requireSchedule(dto.scheduleId, dto.employeeId);
    }

    const shift = await this.prisma.workShift.create({
      data: {
        employeeId: dto.employeeId,
        scheduleId: nullableString(dto.scheduleId),
        date: new Date(dto.date),
        plannedStart: optionalDate(dto.plannedStart),
        plannedEnd: optionalDate(dto.plannedEnd),
        actualStart: optionalDate(dto.actualStart),
        actualEnd: optionalDate(dto.actualEnd),
        status: dto.status ?? WorkShiftStatus.PLANNED,
        comment: nullableString(dto.comment)
      },
      select: workShiftSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "WorkShift",
      entityId: shift.id,
      after: sanitizeJson(shift)
    });

    return { shift };
  }

  async updateShift(id: string, dto: UpdateWorkShiftDto, actorId: string) {
    const before = await this.requireShift(id);
    const employeeId = dto.employeeId ?? before.employeeId;

    if (dto.employeeId) {
      await this.requireEmployee(dto.employeeId);
    }

    if (dto.scheduleId) {
      await this.requireSchedule(dto.scheduleId, employeeId);
    }

    const data: Prisma.WorkShiftUncheckedUpdateInput = {};
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "employeeId", dto.employeeId);
    assignIfDefined(writable, "scheduleId", dto.scheduleId, nullableString);
    assignIfDefined(writable, "date", dto.date, (value) => new Date(value));
    assignIfDefined(writable, "plannedStart", dto.plannedStart, nullableDate);
    assignIfDefined(writable, "plannedEnd", dto.plannedEnd, nullableDate);
    assignIfDefined(writable, "actualStart", dto.actualStart, nullableDate);
    assignIfDefined(writable, "actualEnd", dto.actualEnd, nullableDate);
    assignIfDefined(writable, "status", dto.status);
    assignIfDefined(writable, "comment", dto.comment, nullableString);

    const shift = await this.prisma.workShift.update({
      where: { id },
      data,
      select: workShiftSelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "WorkShift",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(shift)
    });

    return { shift };
  }

  async deleteShift(id: string, actorId: string) {
    const before = await this.requireShift(id);

    await this.prisma.workShift.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "WorkShift",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async listTimeEntries(query: TimeEntryQueryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requireAttendanceRead(access);
    const scopedEmployeeId = this.resolveVisibleEmployeeId(access, query.employeeId);
    const where = this.buildTimeEntryWhere(query, scopedEmployeeId);
    const [total, entries] = await Promise.all([
      this.prisma.timeEntry.count({ where }),
      this.prisma.timeEntry.findMany({
        where,
        select: timeEntrySelect,
        orderBy: [{ date: "desc" }, { startedAt: "desc" }],
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: entries,
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async createTimeEntry(dto: CreateTimeEntryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requireAnyAttendanceAccess(access);
    const employeeId = await this.resolveWritableEmployeeId(access, dto.employeeId);
    const startedAt = new Date(dto.startedAt);
    const endedAt = optionalDate(dto.endedAt);
    const totalMinutes = calculateTotalMinutes(startedAt, endedAt, dto.breakMinutes ?? 0);
    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId,
        date: new Date(dto.date),
        startedAt,
        endedAt,
        breakMinutes: dto.breakMinutes ?? 0,
        totalMinutes,
        source: dto.source ?? TimeEntrySource.MANUAL,
        status: dto.status ?? TimeEntryStatus.DRAFT,
        comment: nullableString(dto.comment)
      },
      select: timeEntrySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: "TimeEntry",
      entityId: entry.id,
      after: sanitizeJson(entry)
    });

    return { timeEntry: entry };
  }

  async updateTimeEntry(id: string, dto: UpdateTimeEntryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    const before = await this.requireTimeEntry(id);

    this.ensureCanWriteEntry(access, before);

    const employeeId = dto.employeeId ?? before.employeeId;

    if (dto.employeeId) {
      await this.resolveWritableEmployeeId(access, dto.employeeId);
    }

    const startedAt = dto.startedAt ? new Date(dto.startedAt) : before.startedAt;
    const endedAt = dto.endedAt !== undefined ? nullableDate(dto.endedAt) : before.endedAt;
    const breakMinutes = dto.breakMinutes ?? before.breakMinutes;
    const data: Prisma.TimeEntryUncheckedUpdateInput = {
      employeeId,
      totalMinutes: calculateTotalMinutes(startedAt, endedAt, breakMinutes)
    };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "date", dto.date, (value) => new Date(value));
    assignIfDefined(writable, "startedAt", dto.startedAt, (value) => new Date(value));
    assignIfDefined(writable, "endedAt", dto.endedAt, nullableDate);
    assignIfDefined(writable, "breakMinutes", dto.breakMinutes);
    assignIfDefined(writable, "source", dto.source);
    assignIfDefined(writable, "status", dto.status);
    assignIfDefined(writable, "comment", dto.comment, nullableString);

    if (dto.status && dto.status !== TimeEntryStatus.APPROVED) {
      data.approvedById = null;
      data.approvedAt = null;
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data,
      select: timeEntrySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "TimeEntry",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(entry)
    });

    return { timeEntry: entry };
  }

  async deleteTimeEntry(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    const before = await this.requireTimeEntry(id);

    this.ensureCanWriteEntry(access, before);
    await this.prisma.timeEntry.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: "TimeEntry",
      entityId: id,
      before: sanitizeJson(before)
    });

    return { success: true };
  }

  async submitTimeEntry(id: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    const before = await this.requireTimeEntry(id);

    this.ensureCanWriteEntry(access, before);
    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.SUBMITTED,
        approvedById: null,
        approvedAt: null
      },
      select: timeEntrySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "TimeEntrySubmit",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(entry)
    });

    return { timeEntry: entry };
  }

  async approveTimeEntry(id: string, actorId: string) {
    const before = await this.requireTimeEntry(id);
    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date()
      },
      select: timeEntrySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "TimeEntryApprove",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(entry)
    });

    return { timeEntry: entry };
  }

  async rejectTimeEntry(id: string, dto: RejectTimeEntryDto, actorId: string) {
    const before = await this.requireTimeEntry(id);
    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.REJECTED,
        approvedById: null,
        approvedAt: null,
        comment: nullableString(dto.comment) ?? before.comment
      },
      select: timeEntrySelect
    });

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "TimeEntryReject",
      entityId: id,
      before: sanitizeJson(before),
      after: sanitizeJson(entry)
    });

    return { timeEntry: entry };
  }

  private buildShiftWhere(query: WorkShiftQueryDto): Prisma.WorkShiftWhereInput {
    return {
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.scheduleId ? { scheduleId: query.scheduleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo ? { date: dateRange(query.dateFrom, query.dateTo) } : {}),
      ...(query.search
        ? {
            OR: [
              { comment: { contains: query.search, mode: "insensitive" } },
              { employee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { employee: { lastName: { contains: query.search, mode: "insensitive" } } },
              { employee: { employeeNumber: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private buildTimeEntryWhere(query: TimeEntryQueryDto, employeeId?: string): Prisma.TimeEntryWhereInput {
    return {
      deletedAt: null,
      ...(employeeId ? { employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo ? { date: dateRange(query.dateFrom, query.dateTo) } : {}),
      ...(query.search
        ? {
            OR: [
              { comment: { contains: query.search, mode: "insensitive" } },
              { employee: { firstName: { contains: query.search, mode: "insensitive" } } },
              { employee: { lastName: { contains: query.search, mode: "insensitive" } } },
              { employee: { employeeNumber: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async getActorAccess(actorId: string): Promise<ActorAccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null, isActive: true },
      select: {
        primaryRole: true,
        employeeProfile: {
          select: { id: true }
        },
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
      throw new ForbiddenException("User is inactive or deleted");
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));
    const permissions = new Set(
      user.roles.flatMap(({ role }) =>
        role.deletedAt
          ? []
          : role.permissions.filter(({ permission }) => !permission.deletedAt).map(({ permission }) => permission.key)
      )
    );

    return {
      isSuperAdmin: user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN),
      permissions,
      employeeId: user.employeeProfile?.id
    };
  }

  private requireAttendanceRead(access: ActorAccess) {
    if (access.isSuperAdmin || access.permissions.has("attendance.read") || access.permissions.has("attendance.manage") || access.permissions.has("attendance.own")) {
      return;
    }

    throw new ForbiddenException("Missing attendance permission");
  }

  private requireAnyAttendanceAccess(access: ActorAccess) {
    this.requireAttendanceRead(access);
  }

  private resolveVisibleEmployeeId(access: ActorAccess, requestedEmployeeId?: string) {
    if (access.isSuperAdmin || access.permissions.has("attendance.read") || access.permissions.has("attendance.manage")) {
      return requestedEmployeeId;
    }

    if (!access.employeeId) {
      throw new ForbiddenException("Employee profile is required for own attendance");
    }

    if (requestedEmployeeId && requestedEmployeeId !== access.employeeId) {
      throw new ForbiddenException("You can only view your own time entries");
    }

    return access.employeeId;
  }

  private async resolveWritableEmployeeId(access: ActorAccess, requestedEmployeeId?: string) {
    if (access.isSuperAdmin || access.permissions.has("attendance.manage")) {
      if (!requestedEmployeeId) {
        throw new BadRequestException("employeeId is required");
      }

      await this.requireEmployee(requestedEmployeeId);
      return requestedEmployeeId;
    }

    if (!access.permissions.has("attendance.own") || !access.employeeId) {
      throw new ForbiddenException("You can only manage your own time entries");
    }

    if (requestedEmployeeId && requestedEmployeeId !== access.employeeId) {
      throw new ForbiddenException("You can only manage your own time entries");
    }

    await this.requireEmployee(access.employeeId);
    return access.employeeId;
  }

  private ensureCanWriteEntry(access: ActorAccess, entry: TimeEntryPayload) {
    if (access.isSuperAdmin || access.permissions.has("attendance.manage")) {
      return;
    }

    if (access.permissions.has("attendance.own") && access.employeeId === entry.employeeId) {
      return;
    }

    throw new ForbiddenException("You can only manage your own time entries");
  }

  private async requireEmployee(id: string) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true }
    });

    if (!employee) {
      throw new BadRequestException("Employee not found or inactive");
    }
  }

  private async requireSchedule(id: string, employeeId?: string) {
    const schedule = await this.prisma.workSchedule.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(employeeId ? { employeeId } : {})
      },
      select: { id: true }
    });

    if (!schedule) {
      throw new BadRequestException("Work schedule not found");
    }
  }

  private async requireShift(id: string) {
    const shift = await this.prisma.workShift.findFirst({
      where: { id, deletedAt: null },
      select: workShiftSelect
    });

    if (!shift) {
      throw new NotFoundException("Work shift not found");
    }

    return shift;
  }

  private async requireTimeEntry(id: string): Promise<TimeEntryPayload> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, deletedAt: null },
      select: timeEntrySelect
    });

    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }

    return entry;
  }
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
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

function optionalDate(value: string | null | undefined) {
  return value ? new Date(value) : undefined;
}

function nullableDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function nullableString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function calculateTotalMinutes(startedAt: Date, endedAt: Date | null | undefined, breakMinutes: number) {
  if (!endedAt) {
    return 0;
  }

  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000) - breakMinutes);
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
