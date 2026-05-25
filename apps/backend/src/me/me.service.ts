import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleCode, TaskStatus, TimeEntryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const userSummarySelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
  primaryRole: true,
  isActive: true,
  roles: {
    where: { deletedAt: null },
    select: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          deletedAt: true,
          permissions: {
            where: { deletedAt: null },
            select: {
              permission: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  resource: true,
                  action: true,
                  deletedAt: true
                }
              }
            }
          }
        }
      }
    }
  }
} satisfies Prisma.UserSelect;

const employeeSelect = {
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
  updatedAt: true
} satisfies Prisma.EmployeeProfileSelect;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  assignedToId: true,
  assigneeEmployeeId: true,
  assigneeDepartment: true,
  responsibilityId: true,
  responsibility: {
    select: {
      id: true,
      title: true,
      category: true,
      status: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.TaskSelect;

const responsibilitySelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  status: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  createdAt: true,
  updatedAt: true,
  assignments: {
    select: {
      id: true,
      responsibilityId: true,
      employeeId: true,
      userId: true,
      role: true,
      assignedAt: true
    }
  }
} satisfies Prisma.ResponsibilitySelect;

const scheduleSelect = {
  id: true,
  employeeId: true,
  name: true,
  type: true,
  workdayHours: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.WorkScheduleSelect;

const shiftSelect = {
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
  updatedAt: true
} satisfies Prisma.WorkShiftSelect;

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
  updatedAt: true
} satisfies Prisma.TimeEntrySelect;

const payrollLineSelect = {
  id: true,
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
  payrollRun: {
    select: {
      id: true,
      status: true,
      period: {
        select: {
          id: true,
          name: true,
          dateFrom: true,
          dateTo: true,
          status: true
        }
      }
    }
  }
} satisfies Prisma.PayrollLineSelect;

const adjustmentSelect = {
  id: true,
  employeeId: true,
  periodId: true,
  type: true,
  amount: true,
  reason: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PayrollAdjustmentSelect;

const secretSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  url: true,
  username: true,
  login: true,
  phone: true,
  email: true,
  responsibilityId: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  encryptedSecret: true,
  encryptedNotes: true,
  createdAt: true,
  updatedAt: true,
  responsibility: {
    select: {
      id: true,
      title: true,
      category: true,
      status: true
    }
  }
} satisfies Prisma.SecretVaultItemSelect;

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.NotificationSelect;

type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: userSummarySelect
    });

    if (!user) {
      throw new NotFoundException("Current user not found");
    }

    const access = buildAccess(user);
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { userId, deletedAt: null },
      select: employeeSelect
    });
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const activeTaskWhere = this.myTaskWhere(userId, employee?.id, {
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
    });

    const [tasks, activeTasks, overdueTasks, responsibilities, schedule, todayShift, nextShift, monthTimeEntries, todayTimeEntries, unreadNotifications, notifications] =
      await Promise.all([
        this.prisma.task.findMany({
          where: activeTaskWhere,
          select: taskSelect,
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 8
        }),
        this.prisma.task.count({ where: activeTaskWhere }),
        this.prisma.task.count({
          where: this.myTaskWhere(userId, employee?.id, {
            dueAt: { lt: now },
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
          })
        }),
        employee ? this.findMyResponsibilities(userId, employee.id) : this.findMyResponsibilities(userId),
        employee ? this.prisma.workSchedule.findFirst({
          where: { employeeId: employee.id, deletedAt: null },
          select: scheduleSelect,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
        }) : Promise.resolve(null),
        employee ? this.prisma.workShift.findFirst({
          where: { employeeId: employee.id, deletedAt: null, date: { gte: today, lt: tomorrow } },
          select: shiftSelect,
          orderBy: { date: "asc" }
        }) : Promise.resolve(null),
        employee ? this.prisma.workShift.findFirst({
          where: { employeeId: employee.id, deletedAt: null, date: { gte: today } },
          select: shiftSelect,
          orderBy: { date: "asc" }
        }) : Promise.resolve(null),
        employee ? this.prisma.timeEntry.findMany({
          where: { employeeId: employee.id, deletedAt: null, date: { gte: monthStart, lt: monthEnd } },
          select: timeEntrySelect,
          orderBy: [{ date: "desc" }, { startedAt: "desc" }]
        }) : Promise.resolve([]),
        employee ? this.prisma.timeEntry.findMany({
          where: { employeeId: employee.id, deletedAt: null, date: { gte: today, lt: tomorrow } },
          select: timeEntrySelect,
          orderBy: { startedAt: "desc" }
        }) : Promise.resolve([]),
        this.prisma.notification.count({ where: { userId, deletedAt: null, readAt: null } }),
        this.prisma.notification.findMany({
          where: { userId, deletedAt: null },
          select: notificationSelect,
          orderBy: { createdAt: "desc" },
          take: 8
        })
      ]);

    const payroll = employee && hasAnyPermission(access, ["payroll.read", "payroll.manage", "payroll.own"])
      ? await this.findMyPayroll(employee.id, now)
      : null;

    const secrets = hasAnyPermission(access, ["secrets.read_metadata"])
      ? await this.findMySecrets(userId, employee?.id, responsibilities.map((responsibility) => responsibility.id))
      : [];

    const workedMinutesThisMonth = monthTimeEntries
      .filter((entry) => entry.status === TimeEntryStatus.APPROVED)
      .reduce((sum, entry) => sum + entry.totalMinutes, 0);
    const workedMinutesToday = todayTimeEntries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
    const unapprovedTimeEntries = monthTimeEntries.filter((entry) => entry.status !== TimeEntryStatus.APPROVED).length;

    return {
      user: serializeUser(user),
      employee,
      stats: {
        activeTasks,
        overdueTasks,
        responsibilities: responsibilities.length,
        workedHoursToday: minutesToHours(workedMinutesToday),
        workedHoursThisMonth: minutesToHours(workedMinutesThisMonth),
        unapprovedTimeEntries,
        unreadNotifications,
        secrets: secrets.length
      },
      tasks,
      responsibilities,
      schedule,
      todayShift,
      nextShift,
      timeEntries: {
        today: todayTimeEntries,
        recent: monthTimeEntries.slice(0, 8)
      },
      payroll,
      secrets,
      notifications
    };
  }

  private myTaskWhere(userId: string, employeeId: string | undefined, extra: Prisma.TaskWhereInput = {}): Prisma.TaskWhereInput {
    return {
      deletedAt: null,
      isEmployeeTask: true,
      OR: [
        { assignedToId: userId },
        ...(employeeId ? [{ assigneeEmployeeId: employeeId }] : [])
      ],
      ...extra
    };
  }

  private findMyResponsibilities(userId: string, employeeId?: string) {
    return this.prisma.responsibility.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: userId },
          { assignments: { some: { userId } } },
          ...(employeeId ? [{ ownerEmployeeId: employeeId }, { assignments: { some: { employeeId } } }] : [])
        ]
      },
      select: responsibilitySelect,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
  }

  private async findMyPayroll(employeeId: string, now: Date) {
    const currentPeriod = await this.prisma.payrollPeriod.findFirst({
      where: {
        deletedAt: null,
        dateFrom: { lte: now },
        dateTo: { gte: now }
      },
      select: { id: true, name: true, dateFrom: true, dateTo: true, status: true },
      orderBy: { dateFrom: "desc" }
    });
    const line = await this.prisma.payrollLine.findFirst({
      where: {
        employeeId,
        deletedAt: null,
        ...(currentPeriod ? { payrollRun: { periodId: currentPeriod.id, deletedAt: null } } : {})
      },
      select: payrollLineSelect,
      orderBy: { createdAt: "desc" }
    });
    const periodId = currentPeriod?.id ?? line?.payrollRun.period.id;
    const adjustments = periodId
      ? await this.prisma.payrollAdjustment.findMany({
          where: { employeeId, periodId, deletedAt: null },
          select: adjustmentSelect,
          orderBy: { createdAt: "desc" },
          take: 8
        })
      : [];

    return {
      period: currentPeriod ?? line?.payrollRun.period ?? null,
      line,
      adjustments
    };
  }

  private async findMySecrets(userId: string, employeeId: string | undefined, responsibilityIds: string[]) {
    const secrets = await this.prisma.secretVaultItem.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: userId },
          ...(employeeId ? [{ ownerEmployeeId: employeeId }] : []),
          ...(responsibilityIds.length ? [{ responsibilityId: { in: responsibilityIds } }] : [])
        ]
      },
      select: secretSelect,
      orderBy: { updatedAt: "desc" },
      take: 8
    });

    return secrets.map(({ encryptedSecret, encryptedNotes, ...secret }) => ({
      ...secret,
      hasSecret: Boolean(encryptedSecret),
      hasNotes: Boolean(encryptedNotes),
      secretMasked: encryptedSecret ? "********" : null,
      notesMasked: encryptedNotes ? "********" : null
    }));
  }
}

function buildAccess(user: UserSummary) {
  const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));
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
    isSuperAdmin: user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN),
    permissions
  };
}

function hasAnyPermission(access: { isSuperAdmin: boolean; permissions: Set<string> }, permissions: string[]) {
  return access.isSuperAdmin || permissions.some((permission) => access.permissions.has(permission));
}

function serializeUser(user: UserSummary) {
  const roles = user.roles
    .filter(({ role }) => !role.deletedAt)
    .map(({ role }) => ({ id: role.id, code: role.code, name: role.name }));
  const permissions = new Map<string, { id: string; key: string; name: string; resource: string; action: string }>();

  for (const { role } of user.roles) {
    if (role.deletedAt) {
      continue;
    }

    for (const { permission } of role.permissions) {
      if (!permission.deletedAt) {
        permissions.set(permission.key, {
          id: permission.id,
          key: permission.key,
          name: permission.name,
          resource: permission.resource,
          action: permission.action
        });
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    locale: user.locale,
    primaryRole: user.primaryRole,
    isActive: user.isActive,
    roles,
    permissions: Array.from(permissions.values())
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}
