"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HandCoins,
  Inbox,
  KeyRound,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  UserRoundCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { EmployeeTask, Responsibility, SecretVaultItem } from "@/components/employee-work/employee-work-types";
import type { Employee, PayrollAdjustment, PayrollLine, TimeEntry, WorkSchedule, WorkShift } from "@/components/hr/hr-types";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/components/hr/hr-ui";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/workspace/metric-card";
import { PageHeader } from "@/components/workspace/page-header";
import { ErrorState, LoadingState } from "@/components/workspace/states";
import type { CurrentUser } from "@/lib/types";

interface MySummary {
  user: CurrentUser;
  employee: Employee | null;
  stats: {
    activeTasks: number;
    overdueTasks: number;
    responsibilities: number;
    workedHoursToday: number;
    workedHoursThisMonth: number;
    unapprovedTimeEntries: number;
    unreadNotifications: number;
    secrets: number;
  };
  tasks: EmployeeTask[];
  responsibilities: Responsibility[];
  schedule: WorkSchedule | null;
  todayShift: WorkShift | null;
  nextShift: WorkShift | null;
  timeEntries: {
    today: TimeEntry[];
    recent: TimeEntry[];
  };
  payroll: {
    period: {
      id: string;
      name: string;
      dateFrom: string;
      dateTo: string;
      status: string;
    } | null;
    line: PayrollLine | null;
    adjustments: PayrollAdjustment[];
  } | null;
  secrets: SecretVaultItem[];
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body?: string | null;
    readAt?: string | null;
    createdAt: string;
  }>;
}

export function MyHomePage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<MySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canCreateTask = auth.hasPermission(["employee_tasks.create", "tasks.create"]);
  const canReadTasks = auth.hasPermission("employee_tasks.read");
  const canAddTime = auth.hasPermission(["attendance.own", "attendance.manage"]);
  const canManageSchedule = auth.hasPermission("attendance.manage");
  const canOpenEmployeeProfile = auth.hasPermission(["employees.read", "employees.update"]);
  const canReadResponsibilities = auth.hasPermission("responsibilities.read");
  const canAssignResponsibility = auth.hasPermission("responsibilities.assign");
  const canReadSecrets = auth.hasPermission("secrets.read_metadata");
  const canRevealSecrets = auth.hasPermission("secrets.reveal");
  const canSeePayroll = Boolean(data?.payroll);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await auth.api.request<MySummary>("/me/summary");
      setData(response);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось загрузить рабочий стол";
      setError(message);
      toast({ title: "Не удалось загрузить рабочий стол", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
    []
  );

  if (auth.status === "loading" || loading) {
    return (
      <main className="space-y-5 p-4 sm:p-6">
        <PageHeader title="Мой рабочий стол" description="Персональная сводка сотрудника и быстрые рабочие действия." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <MetricCard key={index} icon={Loader2} label="Загрузка" loading value="-" />
          ))}
        </div>
        <Card><CardContent><LoadingState label="Загружаем ваши данные" /></CardContent></Card>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="p-4 sm:p-6">
        <ErrorState label="Не удалось открыть главную" description={error ?? undefined} onRetry={() => void load()} />
      </main>
    );
  }

  const employeeName = data.employee ? formatEmployeeName(data.employee) : data.user.name || data.user.email;
  const initials = getInitials(employeeName || data.user.email);

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Мой рабочий стол"
        description="Ваши задачи, ответственности, график, рабочее время и важные уведомления."
        badge={todayLabel}
        actions={
          <Button disabled={loading} type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        }
      />

      <MyHomeHeader
        canAddTime={canAddTime}
        canAssignResponsibility={canAssignResponsibility}
        canCreateTask={canCreateTask}
        canManageSchedule={canManageSchedule}
        canReadResponsibilities={canReadResponsibilities}
        employee={data.employee}
        employeeName={employeeName}
        initials={initials}
        user={data.user}
      />

      <MyStatsGrid data={data} showPayroll={canSeePayroll} showSecrets={canReadSecrets} />

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <MyTasksCard canCreateTask={canCreateTask} canReadTasks={canReadTasks} tasks={data.tasks} />
          <MyResponsibilitiesCard canOpenList={canReadResponsibilities} responsibilities={data.responsibilities} employeeId={data.employee?.id} userId={data.user.id} />
          <MyTimeCard canAddTime={canAddTime} stats={data.stats} timeEntries={data.timeEntries} />
          {canSeePayroll ? <MyPayrollCard payroll={data.payroll} /> : null}
          {canReadSecrets ? <MySecretsCard canRevealSecrets={canRevealSecrets} secrets={data.secrets} /> : null}
        </div>

        <aside className="space-y-4">
          <MyProfileCard canOpenEmployeeProfile={canOpenEmployeeProfile} employee={data.employee} user={data.user} />
          <MyScheduleCard canManageSchedule={canManageSchedule} nextShift={data.nextShift} schedule={data.schedule} todayShift={data.todayShift} />
          <QuickActionsCard
            canAddTime={canAddTime}
            canAssignResponsibility={canAssignResponsibility}
            canCreateTask={canCreateTask}
            canManageSchedule={canManageSchedule}
            canReadResponsibilities={canReadResponsibilities}
            canReadTasks={canReadTasks}
            canReadSecrets={canReadSecrets}
            canSeePayroll={canSeePayroll}
          />
          <MyNotificationsCard notifications={data.notifications} unreadCount={data.stats.unreadNotifications} />
        </aside>
      </section>
    </main>
  );
}

function MyHomeHeader({
  employee,
  user,
  employeeName,
  initials,
  canCreateTask,
  canAddTime,
  canReadResponsibilities,
  canManageSchedule,
  canAssignResponsibility
}: {
  employee: Employee | null;
  user: CurrentUser;
  employeeName: string;
  initials: string;
  canCreateTask: boolean;
  canAddTime: boolean;
  canReadResponsibilities: boolean;
  canManageSchedule: boolean;
  canAssignResponsibility: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/15 text-xl font-semibold text-primary shadow-glow">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">Добро пожаловать,</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold">{employeeName}</h2>
                {employee ? <EmployeeStatusBadge employee={employee} /> : <Badge variant="outline">{user.primaryRole ?? "USER"}</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{employee?.position ?? "Должность не указана"}</span>
                <span>/</span>
                <span>{employee?.department ?? "Отдел не указан"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateTask ? <Button asChild><Link href="/employee-tasks/new"><Plus className="h-4 w-4" /> Создать задачу</Link></Button> : null}
            {canAddTime ? <Button asChild variant="outline"><Link href="/attendance/timesheet"><Clock3 className="h-4 w-4" /> Отметить время</Link></Button> : null}
            {canReadResponsibilities ? <Button asChild variant="outline"><Link href="/responsibilities"><ListChecks className="h-4 w-4" /> Мои ответственности</Link></Button> : null}
            {canManageSchedule ? <Button asChild variant="outline"><Link href="/attendance/shifts"><CalendarClock className="h-4 w-4" /> Мой график</Link></Button> : null}
            {canAssignResponsibility ? <Button asChild variant="outline"><Link href="/responsibilities/new"><Plus className="h-4 w-4" /> Назначить</Link></Button> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MyStatsGrid({ data, showPayroll, showSecrets }: { data: MySummary; showPayroll: boolean; showSecrets: boolean }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={ClipboardCheck} label="Активные задачи" value={data.stats.activeTasks} note={`${data.stats.overdueTasks} просрочено`} tone={data.stats.overdueTasks > 0 ? "warning" : "success"} />
      <MetricCard icon={AlertCircle} label="Просроченные задачи" value={data.stats.overdueTasks} note="Срок уже прошел" tone={data.stats.overdueTasks > 0 ? "danger" : "success"} />
      <MetricCard icon={ListChecks} label="Ответственности" value={data.stats.responsibilities} note="Назначенные зоны" />
      <MetricCard icon={CalendarClock} label="Сегодняшняя смена" value={data.todayShift ? data.todayShift.status : "Нет"} note={data.todayShift ? formatDate(data.todayShift.date) : "Смена не назначена"} />
      <MetricCard icon={Clock3} label="Часы за месяц" value={`${formatNumber(data.stats.workedHoursThisMonth)} ч`} note={`${formatNumber(data.stats.workedHoursToday)} ч сегодня`} />
      {showPayroll ? <MetricCard icon={HandCoins} label="К выплате" value={formatMoney(data.payroll?.line?.netAmount)} note={data.payroll?.period?.name ?? "Период не найден"} /> : null}
      {showPayroll ? <MetricCard icon={CheckCircle2} label="Бонусы / штрафы" value={`${formatMoney(data.payroll?.line?.bonusAmount)} / ${formatMoney(data.payroll?.line?.penaltyAmount)}`} note={`${formatMoney(data.payroll?.line?.commissionAmount)} комиссии`} /> : null}
      <MetricCard icon={Inbox} label="Уведомления" value={data.stats.unreadNotifications} note={showSecrets ? `${data.stats.secrets} доступов metadata` : "Непрочитанные"} />
    </section>
  );
}

function MyProfileCard({ employee, user, canOpenEmployeeProfile }: { employee: Employee | null; user: CurrentUser; canOpenEmployeeProfile: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Мой профиль</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InfoLine label="Имя" value={employee ? formatEmployeeName(employee) : user.name} />
        <InfoLine label="Email" value={employee?.email ?? user.email} />
        <InfoLine label="Телефон" value={employee?.phone ?? user.phone ?? "-"} />
        <InfoLine label="Должность" value={employee?.position ?? "-"} />
        <InfoLine label="Отдел" value={employee?.department ?? "-"} />
        <InfoLine label="Тип занятости" value={employee?.employmentType ?? "-"} />
        <InfoLine label="Дата приема" value={formatDate(employee?.hireDate)} />
        <InfoLine label="Связанный User" value={user.email} />
        <div className="pt-2">
          {employee ? <EmployeeStatusBadge employee={employee} /> : <Badge variant="outline">Профиль сотрудника не связан</Badge>}
        </div>
        {employee && canOpenEmployeeProfile ? (
          <Button asChild className="w-full justify-start" variant="outline">
            <Link href={`/employees/${employee.id}`}>
              <UserRoundCheck className="h-4 w-4" />
              Открыть профиль
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MyTasksCard({ tasks, canCreateTask, canReadTasks }: { tasks: EmployeeTask[]; canCreateTask: boolean; canReadTasks: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Мои задачи</CardTitle>
        <div className="flex gap-2">
          {canReadTasks ? <Button asChild size="sm" variant="outline"><Link href="/employee-tasks">Все мои задачи</Link></Button> : null}
          {canCreateTask ? <Button asChild size="sm"><Link href="/employee-tasks/new"><Plus className="h-4 w-4" /> Создать</Link></Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length ? (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  {canReadTasks ? (
                    <Link className="font-medium text-primary hover:underline" href={`/employee-tasks/${task.id}`}>{task.title}</Link>
                  ) : (
                    <div className="font-medium text-foreground">{task.title}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {task.priority} / {task.dueAt ? formatDateTime(task.dueAt) : "без срока"}
                    {task.responsibility ? ` / ${task.responsibility.title}` : ""}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="У вас пока нет задач" action={canCreateTask ? <Button asChild size="sm" variant="outline"><Link href="/employee-tasks/new">Добавить задачу</Link></Button> : null} />
        )}
      </CardContent>
    </Card>
  );
}

function MyResponsibilitiesCard({
  responsibilities,
  employeeId,
  userId,
  canOpenList
}: {
  responsibilities: Responsibility[];
  employeeId?: string;
  userId: string;
  canOpenList: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Мои ответственности</CardTitle>
        {canOpenList ? <Button asChild size="sm" variant="outline"><Link href="/responsibilities">Открыть список</Link></Button> : null}
      </CardHeader>
      <CardContent>
        {responsibilities.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {responsibilities.slice(0, 6).map((responsibility) => {
              const assignment = responsibility.assignments?.find((item) => item.employeeId === employeeId || item.userId === userId);
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-primary">{responsibility.title}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{responsibility.description ?? responsibility.category ?? "Описание не заполнено"}</div>
                    </div>
                    <StatusBadge status={responsibility.status} />
                  </div>
                  <Badge className="mt-3" variant="outline">{assignment?.role ?? "OWNER"}</Badge>
                </>
              );

              return canOpenList ? (
                <Link key={responsibility.id} href={`/responsibilities/${responsibility.id}`} className="rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-sidebar-hover">
                  {content}
                </Link>
              ) : (
                <div key={responsibility.id} className="rounded-lg border border-border bg-muted/20 p-4">
                  {content}
                </div>
              );
            })}
            {responsibilities.length > 6 ? <div className="rounded-lg border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">Еще {responsibilities.length - 6} ответственностей в общем списке.</div> : null}
          </div>
        ) : (
          <SmallEmpty label="Ответственности не назначены" />
        )}
      </CardContent>
    </Card>
  );
}

function MyScheduleCard({
  schedule,
  todayShift,
  nextShift,
  canManageSchedule
}: {
  schedule: WorkSchedule | null;
  todayShift: WorkShift | null;
  nextShift: WorkShift | null;
  canManageSchedule: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Мой график</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {schedule ? (
          <>
            <InfoLine label="Тип" value={schedule.type} />
            <InfoLine label="Часы" value={`${formatNumber(schedule.workdayHours)} ч`} />
            <InfoLine label="Timezone" value={schedule.timezone} />
            <InfoLine label="Сегодня" value={todayShift ? <StatusBadge status={todayShift.status} /> : "Смены нет"} />
            <InfoLine label="Ближайшая" value={nextShift ? `${formatDate(nextShift.date)} / ${nextShift.status}` : "-"} />
          </>
        ) : (
          <SmallEmpty label="График не назначен" action={canManageSchedule ? <Button asChild size="sm" variant="outline"><Link href="/attendance/shifts">Добавить график</Link></Button> : null} />
        )}
      </CardContent>
    </Card>
  );
}

function MyTimeCard({
  stats,
  timeEntries,
  canAddTime
}: {
  stats: MySummary["stats"];
  timeEntries: MySummary["timeEntries"];
  canAddTime: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Рабочее время</CardTitle>
        {canAddTime ? <Button asChild size="sm" variant="outline"><Link href="/attendance/timesheet"><Plus className="h-4 w-4" /> Добавить время</Link></Button> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Сегодня" value={`${formatNumber(stats.workedHoursToday)} ч`} />
          <MiniMetric label="За месяц" value={`${formatNumber(stats.workedHoursThisMonth)} ч`} />
          <MiniMetric label="Не утверждено" value={stats.unapprovedTimeEntries} />
        </div>
        {timeEntries.today.length ? (
          <div className="space-y-2">
            {timeEntries.today.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <div>
                  <div className="font-medium">{formatNumber(entry.totalMinutes / 60)} ч</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(entry.startedAt)} - {formatDateTime(entry.endedAt)}</div>
                </div>
                <StatusBadge status={entry.status} />
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="За сегодня время не добавлено" action={canAddTime ? <Button asChild size="sm" variant="outline"><Link href="/attendance/timesheet">Добавить вручную</Link></Button> : null} />
        )}
      </CardContent>
    </Card>
  );
}

function MyPayrollCard({ payroll }: { payroll: MySummary["payroll"] }) {
  if (!payroll) {
    return null;
  }

  return (
    <Card id="payroll">
      <CardHeader>
        <CardTitle>Мои начисления</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="Период" value={payroll.period?.name ?? "-"} />
          <MiniMetric label="Начислено" value={formatMoney(payroll.line?.grossAmount)} />
          <MiniMetric label="Комиссии" value={formatMoney(payroll.line?.commissionAmount)} />
          <MiniMetric label="К выплате" value={formatMoney(payroll.line?.netAmount)} />
        </div>
        {payroll.line ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{payroll.period?.name ?? "Последний расчет"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Бонусы {formatMoney(payroll.line.bonusAmount)} / штрафы {formatMoney(payroll.line.penaltyAmount)} / часы {formatNumber(payroll.line.workedHours)}
                </div>
              </div>
              <StatusBadge status={payroll.line.payrollRun?.status ?? payroll.period?.status ?? "OPEN"} />
            </div>
          </div>
        ) : (
          <SmallEmpty label="Начислений за период пока нет" />
        )}
      </CardContent>
    </Card>
  );
}

function MySecretsCard({ secrets, canRevealSecrets }: { secrets: SecretVaultItem[]; canRevealSecrets: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Мои доступы</CardTitle>
        <Button asChild size="sm" variant="outline"><Link href="/secrets">Vault</Link></Button>
      </CardHeader>
      <CardContent>
        {secrets.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {secrets.map((secret) => (
              <div key={secret.id} className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-medium text-primary hover:underline" href={`/secrets/${secret.id}`}>{secret.title}</Link>
                    <div className="mt-1 text-xs text-muted-foreground">{secret.type} / {secret.responsibility?.title ?? "без ответственности"}</div>
                  </div>
                  <Badge variant="outline">{secret.secretMasked ?? "metadata"}</Badge>
                </div>
                {canRevealSecrets ? <Button asChild className="mt-3" size="sm" variant="outline"><Link href={`/secrets/${secret.id}`}><KeyRound className="h-4 w-4" /> Показать</Link></Button> : null}
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="Доступы не назначены" />
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({
  canCreateTask,
  canAddTime,
  canReadResponsibilities,
  canReadTasks,
  canManageSchedule,
  canSeePayroll,
  canReadSecrets,
  canAssignResponsibility
}: {
  canCreateTask: boolean;
  canAddTime: boolean;
  canReadResponsibilities: boolean;
  canReadTasks: boolean;
  canManageSchedule: boolean;
  canSeePayroll: boolean;
  canReadSecrets: boolean;
  canAssignResponsibility: boolean;
}) {
  const actions = [
    canCreateTask ? { href: "/employee-tasks/new", label: "Создать задачу", icon: ClipboardCheck } : null,
    canAddTime ? { href: "/attendance/timesheet", label: "Добавить рабочее время", icon: Clock3 } : null,
    canReadTasks ? { href: "/employee-tasks", label: "Открыть мои задачи", icon: ClipboardCheck } : null,
    canReadResponsibilities ? { href: "/responsibilities", label: "Открыть мои ответственности", icon: ListChecks } : null,
    canManageSchedule ? { href: "/attendance/shifts", label: "Открыть мой график", icon: CalendarClock } : null,
    canSeePayroll ? { href: "#payroll", label: "Открыть мои начисления", icon: HandCoins } : null,
    canReadSecrets ? { href: "/secrets", label: "Открыть доступы", icon: KeyRound } : null,
    canAssignResponsibility ? { href: "/responsibilities/new", label: "Назначить ответственность", icon: Plus } : null
  ].filter(Boolean) as Array<{ href: string; label: string; icon: LucideIcon }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Button key={`${action.href}-${action.label}`} asChild className="w-full justify-start" variant="outline">
            <Link href={action.href}>
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function MyNotificationsCard({ notifications, unreadCount }: { notifications: MySummary["notifications"]; unreadCount: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Уведомления</CardTitle>
        <Badge variant={unreadCount > 0 ? "warning" : "outline"}>{unreadCount} новых</Badge>
      </CardHeader>
      <CardContent>
        {notifications.length ? (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{notification.title}</div>
                  <Badge variant={notification.readAt ? "outline" : "default"}>{notification.type}</Badge>
                </div>
                {notification.body ? <div className="mt-1 text-xs text-muted-foreground">{notification.body}</div> : null}
                <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="Уведомлений нет" />
        )}
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value || "-"}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}

function SmallEmpty({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/15 p-4 text-center text-sm text-muted-foreground">
      <div>{label}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function EmployeeStatusBadge({ employee }: { employee: Employee }) {
  if (employee.fireDate) {
    return <Badge variant="destructive">Уволен</Badge>;
  }

  if (!employee.isActive) {
    return <Badge variant="warning">Неактивен</Badge>;
  }

  return <Badge variant="success">Активен</Badge>;
}

function formatEmployeeName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeNumber;
}

function getInitials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}
