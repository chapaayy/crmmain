"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Edit3,
  HandCoins,
  KeyRound,
  ListChecks,
  Loader2,
  Save,
  Settings2,
  Trash2
} from "lucide-react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import type { EmployeeTask, Responsibility, SecretVaultItem } from "@/components/employee-work/employee-work-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/workspace/page-header";
import { EmptyState, LoadingState } from "@/components/workspace/states";
import type { Employee, PaginatedResponse, PayrollAdjustment, PayrollLine, TimeEntry, UserOption, WorkSchedule, WorkShift } from "./hr-types";
import { compactPayload, formatDate, formatDateTime, formatMoney, formatNumber, fromDateTimeLocal, toInputDate } from "./hr-ui";

interface EmployeeResponse {
  employee: Employee;
}

type UsersResponse = PaginatedResponse<UserOption>;
type EmployeeTab = "overview" | "schedule" | "responsibilities" | "tasks" | "attendance" | "payroll" | "secrets" | "details";

const employmentTypes = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN", "OTHER"];
const scheduleTypes = ["FIVE_TWO", "TWO_TWO", "SHIFT", "FLEXIBLE", "CUSTOM"];
const taskStatuses = ["", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"];

const emptyEmployeeForm = {
  userId: "",
  employeeNumber: "",
  firstName: "",
  lastName: "",
  middleName: "",
  phone: "",
  email: "",
  position: "",
  department: "",
  employmentType: "FULL_TIME",
  hireDate: "",
  fireDate: "",
  baseSalary: "",
  hourlyRate: "",
  shiftRate: "",
  commissionRate: "",
  isActive: "true"
};

const emptyScheduleForm = {
  name: "",
  type: "FIVE_TWO",
  workdayHours: "8",
  startsAt: "",
  endsAt: "",
  timezone: "Europe/Berlin"
};

export function EmployeeEditor({ employeeId, mode = "view" }: { employeeId?: string; mode?: "view" | "edit" }) {
  const isNew = !employeeId;
  const isEditMode = isNew || mode === "edit";
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [payrollAdjustments, setPayrollAdjustments] = useState<PayrollAdjustment[]>([]);
  const [employeeSecrets, setEmployeeSecrets] = useState<SecretVaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<EmployeeTab>("overview");
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);

  const canCreate = auth.hasPermission("employees.create");
  const canUpdate = auth.hasPermission("employees.update");
  const canDelete = auth.hasPermission("employees.delete");
  const canEdit = isNew ? canCreate : canUpdate;
  const canReadResponsibilities = auth.hasPermission("responsibilities.read");
  const canAssignResponsibility = auth.hasPermission(["responsibilities.assign", "responsibilities.update"]);
  const canReadEmployeeTasks = auth.hasPermission(["employee_tasks.read", "tasks.read"]);
  const canCreateTask = auth.hasPermission(["employee_tasks.create", "tasks.create"]);
  const canReadAttendance = auth.hasPermission(["attendance.read", "attendance.manage", "attendance.own"]);
  const canManageAttendance = auth.hasPermission("attendance.manage");
  const canReadPayroll = auth.hasPermission(["payroll.read", "payroll.manage"]);
  const canReadSecrets = auth.hasPermission("secrets.read_metadata");
  const canRevealSecrets = auth.hasPermission("secrets.reveal");

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const [employeeResponse, usersResponse, responsibilitiesResponse, tasksResponse, timeEntriesResponse, shiftsResponse, adjustmentsResponse, secretsResponse] =
        await Promise.all([
          employeeId ? auth.api.request<EmployeeResponse>(`/employees/${employeeId}`) : Promise.resolve(null),
          auth.hasPermission("users.read") ? auth.api.request<UsersResponse>("/users?limit=100") : Promise.resolve(null),
          employeeId && canReadResponsibilities ? auth.api.request<{ data: Responsibility[] }>(`/employees/${employeeId}/responsibilities`) : Promise.resolve(null),
          employeeId && canReadEmployeeTasks ? auth.api.request<PaginatedResponse<EmployeeTask>>(`/employee-tasks?assigneeEmployeeId=${employeeId}&limit=20`) : Promise.resolve(null),
          employeeId && canReadAttendance ? auth.api.request<PaginatedResponse<TimeEntry>>(`/time-entries?employeeId=${employeeId}&limit=20`) : Promise.resolve(null),
          employeeId && canReadAttendance ? auth.api.request<PaginatedResponse<WorkShift>>(`/work-shifts?employeeId=${employeeId}&limit=20`) : Promise.resolve(null),
          employeeId && canReadPayroll ? auth.api.request<PaginatedResponse<PayrollAdjustment>>(`/payroll/adjustments?employeeId=${employeeId}&limit=10`) : Promise.resolve(null),
          employeeId && canReadSecrets ? auth.api.request<PaginatedResponse<SecretVaultItem>>(`/secrets?ownerEmployeeId=${employeeId}&limit=20`) : Promise.resolve(null)
        ]);

      if (employeeResponse) {
        const next = employeeResponse.employee;
        setEmployee(next);
        setForm({
          userId: next.userId,
          employeeNumber: next.employeeNumber,
          firstName: next.firstName,
          lastName: next.lastName,
          middleName: next.middleName ?? "",
          phone: next.phone ?? "",
          email: next.email ?? "",
          position: next.position ?? "",
          department: next.department ?? "",
          employmentType: next.employmentType,
          hireDate: toInputDate(next.hireDate),
          fireDate: toInputDate(next.fireDate),
          baseSalary: String(next.baseSalary ?? ""),
          hourlyRate: String(next.hourlyRate ?? ""),
          shiftRate: String(next.shiftRate ?? ""),
          commissionRate: String(next.commissionRate ?? ""),
          isActive: String(next.isActive)
        });
      }

      setUsers(usersResponse?.data ?? []);
      setResponsibilities(responsibilitiesResponse?.data ?? []);
      setEmployeeTasks(tasksResponse?.data ?? []);
      setTimeEntries(timeEntriesResponse?.data ?? []);
      setWorkShifts(shiftsResponse?.data ?? []);
      setPayrollAdjustments(adjustmentsResponse?.data ?? []);
      setEmployeeSecrets(secretsResponse?.data ?? []);
    } catch (error) {
      toast({ title: "Не удалось загрузить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth, canReadAttendance, canReadEmployeeTasks, canReadPayroll, canReadResponsibilities, canReadSecrets, employeeId, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  const monthWorkedHours = useMemo(() => {
    const now = new Date();
    return timeEntries
      .filter((entry) => {
        const date = new Date(entry.date);
        return entry.status === "APPROVED" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, entry) => sum + entry.totalMinutes / 60, 0);
  }, [timeEntries]);

  const activeTasks = useMemo(() => employeeTasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED"), [employeeTasks]);
  const filteredTasks = useMemo(
    () => (taskStatusFilter ? employeeTasks.filter((task) => task.status === taskStatusFilter) : employeeTasks),
    [employeeTasks, taskStatusFilter]
  );
  const activeSchedule = employee?.schedules?.find((schedule) => schedule.isActive) ?? employee?.schedules?.[0];
  const latestPayrollLine = employee?.payrollLines?.[0];

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = compactPayload({
        ...form,
        isActive: form.isActive === "true",
        baseSalary: form.baseSalary ? Number(form.baseSalary) : undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        shiftRate: form.shiftRate ? Number(form.shiftRate) : undefined,
        commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined
      });

      if (isNew) {
        const response = await auth.api.request<EmployeeResponse>("/employees", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast({ title: "Сотрудник создан", variant: "success" });
        router.replace(`/employees/${response.employee.id}`);
      } else if (employeeId) {
        const response = await auth.api.request<EmployeeResponse>(`/employees/${employeeId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setEmployee(response.employee);
        toast({ title: "Сотрудник сохранен", variant: "success" });
        router.replace(`/employees/${employeeId}`);
      }
    } catch (error) {
      toast({ title: "Не удалось сохранить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!employeeId || !window.confirm("Удалить сотрудника?")) {
      return;
    }

    try {
      await auth.api.request(`/employees/${employeeId}`, { method: "DELETE" });
      toast({ title: "Сотрудник удален", variant: "success" });
      router.replace("/employees");
    } catch (error) {
      toast({ title: "Не удалось удалить сотрудника", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!employeeId) {
      return;
    }

    try {
      await auth.api.request(`/employees/${employeeId}/schedules`, {
        method: "POST",
        body: JSON.stringify(
          compactPayload({
            ...scheduleForm,
            workdayHours: Number(scheduleForm.workdayHours),
            startsAt: fromDateTimeLocal(scheduleForm.startsAt),
            endsAt: fromDateTimeLocal(scheduleForm.endsAt)
          })
        )
      });
      toast({ title: "График добавлен", variant: "success" });
      setScheduleForm(emptyScheduleForm);
      await load();
    } catch (error) {
      toast({ title: "Не удалось добавить график", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function runTimeEntryAction(id: string, path: "submit" | "approve" | "reject") {
    try {
      await auth.api.request(`/time-entries/${id}/${path}`, {
        method: "POST",
        body: path === "reject" ? JSON.stringify({}) : undefined
      });
      toast({ title: "Действие выполнено", variant: "success" });
      await load();
    } catch (error) {
      toast({ title: "Действие не выполнено", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  if (isEditMode) {
    return (
      <PermissionGate permission={isNew ? "employees.create" : "employees.update"}>
        <main className="space-y-5 p-4 sm:p-6">
          <PageHeader
            title={isNew ? "Новый сотрудник" : "Редактировать сотрудника"}
            description="Полная анкета разбита на секции, чтобы не перегружать рабочую карточку сотрудника."
            actions={
              <>
                <Button type="button" variant="ghost" onClick={() => router.push(isNew ? "/employees" : `/employees/${employeeId}`)}>
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </Button>
                {!isNew && canDelete ? (
                  <Button type="button" variant="destructive" onClick={() => void deleteEmployee()}>
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                ) : null}
              </>
            }
          />
          {loading ? (
            <Card><CardContent><LoadingState label="Загрузка сотрудника" /></CardContent></Card>
          ) : (
            <EmployeeEditForm
              canEdit={canEdit}
              form={form}
              saving={saving}
              users={users}
              onFieldChange={updateField}
              onSubmit={submit}
            />
          )}
        </main>
      </PermissionGate>
    );
  }

  return (
    <PermissionGate permission="employees.read">
      <main className="space-y-5 p-4 sm:p-6">
        {loading ? (
          <Card><CardContent><LoadingState label="Загрузка сотрудника" /></CardContent></Card>
        ) : employee ? (
          <>
            <PageHeader
              title="Карточка сотрудника"
              description="Обзор сотрудника, рабочие блоки и связанные данные без перегруженной формы."
              actions={
                <Button asChild variant="ghost">
                  <Link href="/employees">
                    <ArrowLeft className="h-4 w-4" />
                    К списку
                  </Link>
                </Button>
              }
            />
            <EmployeeHeader
              employee={employee}
              canAssignResponsibility={canAssignResponsibility}
              canCreateTask={canCreateTask}
              canUpdate={canUpdate}
            />

            <EmployeeStatsGrid
              activeTasksCount={activeTasks.length}
              employee={employee}
              latestPayrollLine={latestPayrollLine}
              monthWorkedHours={monthWorkedHours}
              responsibilitiesCount={responsibilities.length}
              showPayroll={canReadPayroll}
            />

            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <EmployeeTabs
                  activeTab={activeTab}
                  canReadPayroll={canReadPayroll}
                  canReadSecrets={canReadSecrets}
                  onChange={setActiveTab}
                />
                <Card>
                  <CardContent className="p-4">
                    {activeTab === "overview" ? (
                      <EmployeeOverviewTab
                        activeSchedule={activeSchedule}
                        activeTasks={activeTasks}
                        employee={employee}
                        latestPayrollLine={latestPayrollLine}
                        responsibilities={responsibilities}
                        shifts={workShifts}
                      />
                    ) : null}
                    {activeTab === "schedule" ? (
                      <EmployeeScheduleTab
                        canCreateSchedule={canUpdate}
                        canManageAttendance={canManageAttendance}
                        employee={employee}
                        scheduleForm={scheduleForm}
                        shifts={workShifts}
                        onCreateSchedule={createSchedule}
                        onScheduleFormChange={setScheduleForm}
                      />
                    ) : null}
                    {activeTab === "responsibilities" ? (
                      <EmployeeResponsibilitiesTab
                        canAssignResponsibility={canAssignResponsibility}
                        employeeId={employee.id}
                        responsibilities={responsibilities}
                      />
                    ) : null}
                    {activeTab === "tasks" ? (
                      <EmployeeTasksTab
                        canCreateTask={canCreateTask}
                        statusFilter={taskStatusFilter}
                        tasks={filteredTasks}
                        onStatusFilterChange={setTaskStatusFilter}
                      />
                    ) : null}
                    {activeTab === "attendance" ? (
                      <EmployeeAttendanceTab
                        canManageAttendance={canManageAttendance}
                        entries={timeEntries}
                        monthWorkedHours={monthWorkedHours}
                        onAction={runTimeEntryAction}
                      />
                    ) : null}
                    {activeTab === "payroll" && canReadPayroll ? (
                      <EmployeePayrollTab employee={employee} adjustments={payrollAdjustments} />
                    ) : null}
                    {activeTab === "secrets" && canReadSecrets ? (
                      <EmployeeSecretsTab canRevealSecrets={canRevealSecrets} secrets={employeeSecrets} />
                    ) : null}
                    {activeTab === "details" ? (
                      <EmployeeDetailsTab employee={employee} />
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-4">
                <EmployeeRatesCard employee={employee} />
                <EmployeeScheduleCard schedule={activeSchedule} />
                <EmployeeQuickActions
                  canAssignResponsibility={canAssignResponsibility}
                  canCreateTask={canCreateTask}
                  canUpdate={canUpdate}
                  employeeId={employee.id}
                />
              </aside>
            </div>
          </>
        ) : (
          <EmptyState label="Сотрудник не найден" />
        )}
      </main>
    </PermissionGate>
  );
}

function EmployeeHeader({
  employee,
  canUpdate,
  canCreateTask,
  canAssignResponsibility
}: {
  employee: Employee;
  canUpdate: boolean;
  canCreateTask: boolean;
  canAssignResponsibility: boolean;
}) {
  const fullName = formatEmployeeName(employee);
  const initials = `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase() || "E";
  const status = getEmployeeStatus(employee);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/15 text-xl font-semibold text-primary shadow-glow">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold">{fullName}</h2>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{employee.position || "Должность не указана"}</span>
                <span>/</span>
                <span>{employee.department || "Отдел не указан"}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Табельный номер: {employee.employeeNumber}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <>
                <Button asChild>
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Edit3 className="h-4 w-4" />
                    Редактировать
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Settings2 className="h-4 w-4" />
                    Расширенные настройки
                  </Link>
                </Button>
              </>
            ) : null}
            {canCreateTask ? (
              <Button asChild variant="outline">
                <Link href="/employee-tasks/new">
                  <ClipboardCheck className="h-4 w-4" />
                  Создать задачу
                </Link>
              </Button>
            ) : null}
            {canAssignResponsibility ? (
              <Button asChild variant="outline">
                <Link href="/responsibilities/new">
                  <ListChecks className="h-4 w-4" />
                  Назначить ответственность
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeStatsGrid({
  employee,
  monthWorkedHours,
  activeTasksCount,
  responsibilitiesCount,
  latestPayrollLine,
  showPayroll
}: {
  employee: Employee;
  monthWorkedHours: number;
  activeTasksCount: number;
  responsibilitiesCount: number;
  latestPayrollLine?: PayrollLine;
  showPayroll: boolean;
}) {
  const stats = [
    { label: "Оклад", value: formatMoney(employee.baseSalary), icon: HandCoins },
    { label: "Почасовая", value: formatMoney(employee.hourlyRate), icon: Clock3 },
    { label: "За смену", value: formatMoney(employee.shiftRate), icon: CalendarClock },
    { label: "Комиссия", value: employee.commissionRate ? `${formatNumber(employee.commissionRate)}%` : "-", icon: BriefcaseBusiness },
    { label: "Часов в месяце", value: formatNumber(monthWorkedHours), icon: Clock3 },
    { label: "Активных задач", value: activeTasksCount, icon: ClipboardCheck },
    { label: "Ответственностей", value: responsibilitiesCount, icon: ListChecks },
    { label: "К выплате", value: showPayroll ? formatMoney(latestPayrollLine?.netAmount) : "Нет доступа", icon: HandCoins }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/15 text-primary">
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{stat.label}</div>
              <div className="mt-1 truncate text-lg font-semibold">{stat.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function EmployeeTabs({
  activeTab,
  canReadPayroll,
  canReadSecrets,
  onChange
}: {
  activeTab: EmployeeTab;
  canReadPayroll: boolean;
  canReadSecrets: boolean;
  onChange: (tab: EmployeeTab) => void;
}) {
  const tabs: Array<{ id: EmployeeTab; label: string }> = [
    { id: "overview", label: "Обзор" },
    { id: "schedule", label: "График" },
    { id: "responsibilities", label: "Ответственности" },
    { id: "tasks", label: "Задачи" },
    { id: "attendance", label: "Рабочее время" },
    ...(canReadPayroll ? [{ id: "payroll" as const, label: "Зарплата" }] : []),
    ...(canReadSecrets ? [{ id: "secrets" as const, label: "Доступы" }] : []),
    { id: "details", label: "Данные" }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card/80 p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`h-9 shrink-0 rounded-md px-3 text-sm transition-colors ${activeTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmployeeOverviewTab({
  employee,
  activeSchedule,
  responsibilities,
  activeTasks,
  shifts,
  latestPayrollLine
}: {
  employee: Employee;
  activeSchedule?: WorkSchedule;
  responsibilities: Responsibility[];
  activeTasks: EmployeeTask[];
  shifts: WorkShift[];
  latestPayrollLine?: PayrollLine;
}) {
  const nextShift = [...shifts].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()).find((shift) => new Date(shift.date) >= startOfToday());

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <InfoPanel title="Краткая информация">
        <InfoLine label="Телефон" value={employee.phone} />
        <InfoLine label="Email" value={employee.email} />
        <InfoLine label="Тип занятости" value={employee.employmentType} />
        <InfoLine label="Дата приема" value={formatDate(employee.hireDate)} />
        <InfoLine label="Стаж" value={formatTenure(employee.hireDate)} />
        <InfoLine label="Связанный User" value={employee.user ? `${employee.user.name} / ${employee.user.email}` : employee.userId} />
      </InfoPanel>
      <InfoPanel title="Ближайшая работа">
        <InfoLine label="График" value={activeSchedule ? `${activeSchedule.name} / ${activeSchedule.type}` : "График не задан"} />
        <InfoLine label="Часы" value={activeSchedule ? `${activeSchedule.workdayHours} ч / ${activeSchedule.timezone}` : "-"} />
        <InfoLine label="Ближайшая смена" value={nextShift ? `${formatDate(nextShift.date)} / ${nextShift.status}` : "Нет запланированных смен"} />
        <InfoLine label="Последнее начисление" value={latestPayrollLine ? formatMoney(latestPayrollLine.netAmount) : "-"} />
      </InfoPanel>
      <CompactList
        action={<Button asChild size="sm" variant="outline"><Link href="/responsibilities/new">Назначить</Link></Button>}
        empty="Ответственностей пока нет"
        items={responsibilities.slice(0, 4).map((responsibility) => ({
          id: responsibility.id,
          title: responsibility.title,
          meta: responsibility.category ?? "Без категории",
          href: `/responsibilities/${responsibility.id}`,
          status: responsibility.status
        }))}
        title="Основные ответственности"
      />
      <CompactList
        action={<Button asChild size="sm" variant="outline"><Link href="/employee-tasks/new">Добавить задачу</Link></Button>}
        empty="Активных задач пока нет"
        items={activeTasks.slice(0, 4).map((task) => ({
          id: task.id,
          title: task.title,
          meta: `${task.priority} / ${task.dueAt ? formatDate(task.dueAt) : "без срока"}`,
          href: `/employee-tasks/${task.id}`,
          status: task.status
        }))}
        title="Активные задачи"
      />
    </div>
  );
}

function EmployeeScheduleTab({
  employee,
  shifts,
  scheduleForm,
  canCreateSchedule,
  canManageAttendance,
  onScheduleFormChange,
  onCreateSchedule
}: {
  employee: Employee;
  shifts: WorkShift[];
  scheduleForm: typeof emptyScheduleForm;
  canCreateSchedule: boolean;
  canManageAttendance: boolean;
  onScheduleFormChange: (form: typeof emptyScheduleForm) => void;
  onCreateSchedule: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <SectionTitle title="Графики работы" action={canCreateSchedule ? <Button asChild size="sm" variant="outline"><Link href="#schedule-form">Добавить график</Link></Button> : null} />
        {employee.schedules?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {employee.schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{schedule.name}</div>
                  <StatusBadge status={schedule.isActive ? "ACTIVE" : "CLOSED"} />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{schedule.type}</div>
                <div className="mt-3 grid gap-2 text-sm">
                  <InfoLine label="Часов в день" value={`${schedule.workdayHours}`} />
                  <InfoLine label="Timezone" value={schedule.timezone} />
                  <InfoLine label="Начало" value={formatDateTime(schedule.startsAt)} />
                  <InfoLine label="Конец" value={formatDateTime(schedule.endsAt)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="График не добавлен" action={canCreateSchedule ? <Button asChild size="sm" variant="outline"><Link href="#schedule-form">Добавить график</Link></Button> : null} />
        )}

        <SectionTitle title="Смены" action={canManageAttendance ? <Button asChild size="sm" variant="outline"><Link href="/attendance/shifts">Добавить смену</Link></Button> : null} />
        {shifts.length ? (
          <div className="space-y-2">
            {shifts.slice(0, 8).map((shift) => (
              <div key={shift.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{formatDate(shift.date)}</div>
                  <div className="text-xs text-muted-foreground">{shift.schedule?.name ?? "Без графика"} / {shift.comment ?? "без комментария"}</div>
                </div>
                <StatusBadge status={shift.status} />
              </div>
            ))}
          </div>
        ) : (
          <SmallEmpty label="Смен пока нет" action={canManageAttendance ? <Button asChild size="sm" variant="outline"><Link href="/attendance/shifts">Добавить смену</Link></Button> : null} />
        )}
      </div>

      {canCreateSchedule ? (
        <Card id="schedule-form">
          <CardHeader>
            <CardTitle>Добавить график</CardTitle>
            <CardDescription>Краткая форма для рабочего расписания сотрудника.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void onCreateSchedule(event)}>
              <Input placeholder="Название графика" value={scheduleForm.name} onChange={(event) => onScheduleFormChange({ ...scheduleForm, name: event.target.value })} />
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scheduleForm.type} onChange={(event) => onScheduleFormChange({ ...scheduleForm, type: event.target.value })}>
                {scheduleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <Input min="0" step="0.25" type="number" value={scheduleForm.workdayHours} onChange={(event) => onScheduleFormChange({ ...scheduleForm, workdayHours: event.target.value })} />
              <Input type="datetime-local" value={scheduleForm.startsAt} onChange={(event) => onScheduleFormChange({ ...scheduleForm, startsAt: event.target.value })} />
              <Input type="datetime-local" value={scheduleForm.endsAt} onChange={(event) => onScheduleFormChange({ ...scheduleForm, endsAt: event.target.value })} />
              <Input value={scheduleForm.timezone} onChange={(event) => onScheduleFormChange({ ...scheduleForm, timezone: event.target.value })} />
              <Button className="w-full" type="submit" variant="outline">Добавить график</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EmployeeResponsibilitiesTab({ responsibilities, employeeId, canAssignResponsibility }: { responsibilities: Responsibility[]; employeeId: string; canAssignResponsibility: boolean }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Ответственности сотрудника" action={canAssignResponsibility ? <Button asChild size="sm" variant="outline"><Link href="/responsibilities/new">Назначить ответственность</Link></Button> : null} />
      {responsibilities.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {responsibilities.map((responsibility) => {
            const assignment = responsibility.assignments?.find((item) => item.employeeId === employeeId);

            return (
              <Link key={responsibility.id} href={`/responsibilities/${responsibility.id}`} className="rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-sidebar-hover">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-primary">{responsibility.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{responsibility.category ?? "Без категории"}</div>
                  </div>
                  <StatusBadge status={responsibility.status} />
                </div>
                <div className="mt-3">
                  <Badge variant="outline">{assignment?.role ?? "PARTICIPANT"}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <SmallEmpty label="Ответственностей пока нет" action={canAssignResponsibility ? <Button asChild size="sm" variant="outline"><Link href="/responsibilities/new">Назначить</Link></Button> : null} />
      )}
    </div>
  );
}

function EmployeeTasksTab({
  tasks,
  statusFilter,
  canCreateTask,
  onStatusFilterChange
}: {
  tasks: EmployeeTask[];
  statusFilter: string;
  canCreateTask: boolean;
  onStatusFilterChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select className="h-10 rounded-md border bg-background px-3 text-sm sm:w-56" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          {taskStatuses.map((status) => <option key={status || "all"} value={status}>{status || "Все статусы"}</option>)}
        </select>
        {canCreateTask ? <Button asChild size="sm" variant="outline"><Link href="/employee-tasks/new">Добавить задачу</Link></Button> : null}
      </div>
      {tasks.length ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link className="font-medium text-primary hover:underline" href={`/employee-tasks/${task.id}`}>{task.title}</Link>
                <div className="mt-1 text-xs text-muted-foreground">{task.priority} / {task.dueAt ? formatDate(task.dueAt) : "без срока"}</div>
              </div>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      ) : (
        <SmallEmpty label="Задач пока нет" action={canCreateTask ? <Button asChild size="sm" variant="outline"><Link href="/employee-tasks/new">Добавить задачу</Link></Button> : null} />
      )}
    </div>
  );
}

function EmployeeAttendanceTab({
  entries,
  monthWorkedHours,
  canManageAttendance,
  onAction
}: {
  entries: TimeEntry[];
  monthWorkedHours: number;
  canManageAttendance: boolean;
  onAction: (id: string, path: "submit" | "approve" | "reject") => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Отработано в месяце" value={`${formatNumber(monthWorkedHours)} ч`} />
        <MiniMetric label="Не утверждено" value={`${formatNumber(entries.filter((entry) => entry.status !== "APPROVED").reduce((sum, entry) => sum + entry.totalMinutes / 60, 0))} ч`} />
        <MiniMetric label="Записей" value={entries.length} />
      </div>
      {entries.length ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-medium">{formatDate(entry.date)} / {formatNumber(entry.totalMinutes / 60)} ч</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(entry.startedAt)} - {formatDateTime(entry.endedAt)} / перерыв {entry.breakMinutes} мин</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.status} />
                {entry.status === "DRAFT" ? <Button size="sm" type="button" variant="outline" onClick={() => void onAction(entry.id, "submit")}>Отправить</Button> : null}
                {canManageAttendance && entry.status !== "APPROVED" ? <Button size="sm" type="button" variant="outline" onClick={() => void onAction(entry.id, "approve")}>Утвердить</Button> : null}
                {canManageAttendance && entry.status !== "REJECTED" ? <Button size="sm" type="button" variant="outline" onClick={() => void onAction(entry.id, "reject")}>Отклонить</Button> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SmallEmpty label="Записей рабочего времени пока нет" action={<Button asChild size="sm" variant="outline"><Link href="/attendance/timesheet">Открыть табель</Link></Button>} />
      )}
    </div>
  );
}

function EmployeePayrollTab({ employee, adjustments }: { employee: Employee; adjustments: PayrollAdjustment[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Оклад" value={formatMoney(employee.baseSalary)} />
        <MiniMetric label="Почасовая" value={formatMoney(employee.hourlyRate)} />
        <MiniMetric label="Смена" value={formatMoney(employee.shiftRate)} />
        <MiniMetric label="Комиссия" value={employee.commissionRate ? `${formatNumber(employee.commissionRate)}%` : "-"} />
      </div>
      <SectionTitle title="Последние начисления" />
      {employee.payrollLines?.length ? (
        <div className="space-y-2">
          {employee.payrollLines.map((line) => (
            <div key={line.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{line.payrollRun?.period?.name ?? "Период"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(line.payrollRun?.period?.dateFrom)} - {formatDate(line.payrollRun?.period?.dateTo)}</div>
                </div>
                <div className="text-right">
                  <StatusBadge status={line.payrollRun?.status ?? "DRAFT"} />
                  <div className="mt-1 font-semibold">{formatMoney(line.netAmount)}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Бонусы: {formatMoney(line.bonusAmount)}</span>
                <span>Штрафы: {formatMoney(line.penaltyAmount)}</span>
                <span>Комиссия: {formatMoney(line.commissionAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SmallEmpty label="Истории начислений пока нет" />
      )}

      <SectionTitle title="Бонусы / штрафы" />
      {adjustments.length ? (
        <div className="space-y-2">
          {adjustments.map((adjustment) => (
            <div key={adjustment.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div>
                <StatusBadge status={adjustment.type} />
                <div className="mt-1 text-xs text-muted-foreground">{adjustment.reason}</div>
              </div>
              <div className="font-semibold">{formatMoney(adjustment.amount)}</div>
            </div>
          ))}
        </div>
      ) : (
        <SmallEmpty label="Бонусов и штрафов пока нет" />
      )}
    </div>
  );
}

function EmployeeSecretsTab({ secrets, canRevealSecrets }: { secrets: SecretVaultItem[]; canRevealSecrets: boolean }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Доступы / Vault" action={<Button asChild size="sm" variant="outline"><Link href="/secrets/new">Добавить доступ</Link></Button>} />
      {secrets.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {secrets.map((secret) => (
            <div key={secret.id} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link className="font-medium text-primary hover:underline" href={`/secrets/${secret.id}`}>{secret.title}</Link>
                  <div className="mt-1 text-sm text-muted-foreground">{secret.type}</div>
                </div>
                <Badge variant="outline">{secret.secretMasked ?? "********"}</Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{secret.login || secret.username || secret.email || secret.phone || secret.url || "metadata only"}</div>
              {canRevealSecrets ? <Button asChild className="mt-3" size="sm" variant="outline"><Link href={`/secrets/${secret.id}`}><KeyRound className="h-4 w-4" /> Показать</Link></Button> : null}
            </div>
          ))}
        </div>
      ) : (
        <SmallEmpty label="Доступов пока нет" action={<Button asChild size="sm" variant="outline"><Link href="/secrets/new">Добавить доступ</Link></Button>} />
      )}
    </div>
  );
}

function EmployeeDetailsTab({ employee }: { employee: Employee }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoPanel title="Анкета">
        <InfoLine label="User ID" value={employee.userId} />
        <InfoLine label="Табельный номер" value={employee.employeeNumber} />
        <InfoLine label="Имя" value={employee.firstName} />
        <InfoLine label="Фамилия" value={employee.lastName} />
        <InfoLine label="Отчество" value={employee.middleName} />
        <InfoLine label="Телефон" value={employee.phone} />
        <InfoLine label="Email" value={employee.email} />
      </InfoPanel>
      <InfoPanel title="Работа и ставки">
        <InfoLine label="Должность" value={employee.position} />
        <InfoLine label="Отдел" value={employee.department} />
        <InfoLine label="Тип занятости" value={employee.employmentType} />
        <InfoLine label="Дата приема" value={formatDate(employee.hireDate)} />
        <InfoLine label="Дата увольнения" value={formatDate(employee.fireDate)} />
        <InfoLine label="Оклад" value={formatMoney(employee.baseSalary)} />
        <InfoLine label="Почасовая ставка" value={formatMoney(employee.hourlyRate)} />
        <InfoLine label="Ставка за смену" value={formatMoney(employee.shiftRate)} />
        <InfoLine label="Комиссия" value={employee.commissionRate ? `${formatNumber(employee.commissionRate)}%` : "-"} />
        <InfoLine label="Активность" value={employee.isActive ? "Активен" : "Неактивен"} />
      </InfoPanel>
    </div>
  );
}

function EmployeeRatesCard({ employee }: { employee: Employee }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ставки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <InfoLine label="Оклад" value={formatMoney(employee.baseSalary)} />
        <InfoLine label="Час" value={formatMoney(employee.hourlyRate)} />
        <InfoLine label="Смена" value={formatMoney(employee.shiftRate)} />
        <InfoLine label="Комиссия" value={employee.commissionRate ? `${formatNumber(employee.commissionRate)}%` : "-"} />
      </CardContent>
    </Card>
  );
}

function EmployeeScheduleCard({ schedule }: { schedule?: WorkSchedule }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>График</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {schedule ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{schedule.name}</span>
              <StatusBadge status={schedule.isActive ? "ACTIVE" : "CLOSED"} />
            </div>
            <InfoLine label="Тип" value={schedule.type} />
            <InfoLine label="Часы" value={`${schedule.workdayHours} ч`} />
            <InfoLine label="Timezone" value={schedule.timezone} />
          </>
        ) : (
          <SmallEmpty label="График не задан" />
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeQuickActions({
  employeeId,
  canUpdate,
  canCreateTask,
  canAssignResponsibility
}: {
  employeeId: string;
  canUpdate: boolean;
  canCreateTask: boolean;
  canAssignResponsibility: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {canUpdate ? <Button asChild className="w-full justify-start" variant="outline"><Link href={`/employees/${employeeId}/edit`}><Edit3 className="h-4 w-4" /> Редактировать</Link></Button> : null}
        {canCreateTask ? <Button asChild className="w-full justify-start" variant="outline"><Link href="/employee-tasks/new"><ClipboardCheck className="h-4 w-4" /> Создать задачу</Link></Button> : null}
        {canAssignResponsibility ? <Button asChild className="w-full justify-start" variant="outline"><Link href="/responsibilities/new"><ListChecks className="h-4 w-4" /> Назначить ответственность</Link></Button> : null}
        <Button asChild className="w-full justify-start" variant="ghost"><Link href="/attendance/timesheet"><Clock3 className="h-4 w-4" /> Открыть табель</Link></Button>
      </CardContent>
    </Card>
  );
}

function EmployeeEditForm({
  form,
  users,
  canEdit,
  saving,
  onFieldChange,
  onSubmit
}: {
  form: typeof emptyEmployeeForm;
  users: UserOption[];
  canEdit: boolean;
  saving: boolean;
  onFieldChange: (key: keyof typeof emptyEmployeeForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4 xl:grid-cols-2">
        <FormSection title="Основные данные">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Пользователь" className="md:col-span-2">
              {users.length ? (
                <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.userId} onChange={(event) => onFieldChange("userId", event.target.value)}>
                  <option value="">Выберите User</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} / {user.email}</option>
                  ))}
                </select>
              ) : (
                <Input disabled={!canEdit} value={form.userId} onChange={(event) => onFieldChange("userId", event.target.value)} />
              )}
            </Field>
            <Field label="Имя"><Input disabled={!canEdit} value={form.firstName} onChange={(event) => onFieldChange("firstName", event.target.value)} /></Field>
            <Field label="Фамилия"><Input disabled={!canEdit} value={form.lastName} onChange={(event) => onFieldChange("lastName", event.target.value)} /></Field>
            <Field label="Отчество"><Input disabled={!canEdit} value={form.middleName} onChange={(event) => onFieldChange("middleName", event.target.value)} /></Field>
            <Field label="Телефон"><Input disabled={!canEdit} value={form.phone} onChange={(event) => onFieldChange("phone", event.target.value)} /></Field>
            <Field label="Email" className="md:col-span-2"><Input disabled={!canEdit} value={form.email} onChange={(event) => onFieldChange("email", event.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Работа">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Должность"><Input disabled={!canEdit} value={form.position} onChange={(event) => onFieldChange("position", event.target.value)} /></Field>
            <Field label="Отдел"><Input disabled={!canEdit} value={form.department} onChange={(event) => onFieldChange("department", event.target.value)} /></Field>
            <Field label="Тип занятости">
              <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.employmentType} onChange={(event) => onFieldChange("employmentType", event.target.value)}>
                {employmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Активность">
              <select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.isActive} onChange={(event) => onFieldChange("isActive", event.target.value)}>
                <option value="true">Активен</option>
                <option value="false">Неактивен</option>
              </select>
            </Field>
            <Field label="Дата приема"><Input disabled={!canEdit} type="date" value={form.hireDate} onChange={(event) => onFieldChange("hireDate", event.target.value)} /></Field>
            <Field label="Дата увольнения"><Input disabled={!canEdit} type="date" value={form.fireDate} onChange={(event) => onFieldChange("fireDate", event.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Ставки">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Оклад"><Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.baseSalary} onChange={(event) => onFieldChange("baseSalary", event.target.value)} /></Field>
            <Field label="Почасовая ставка"><Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.hourlyRate} onChange={(event) => onFieldChange("hourlyRate", event.target.value)} /></Field>
            <Field label="Ставка за смену"><Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.shiftRate} onChange={(event) => onFieldChange("shiftRate", event.target.value)} /></Field>
            <Field label="Комиссия %"><Input disabled={!canEdit} min="0" step="0.01" type="number" value={form.commissionRate} onChange={(event) => onFieldChange("commissionRate", event.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Системное">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Табельный номер"><Input disabled={!canEdit} value={form.employeeNumber} onChange={(event) => onFieldChange("employeeNumber", event.target.value)} /></Field>
            <Field label="Связанный User ID"><Input disabled={!canEdit} value={form.userId} onChange={(event) => onFieldChange("userId", event.target.value)} /></Field>
          </div>
        </FormSection>
      </div>
      {canEdit ? (
        <Button disabled={saving} type="submit">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      ) : null}
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`space-y-2 text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 font-medium">{title}</div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: ReactNode | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value || "-"}</span>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold">{title}</h3>
      {action}
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

function CompactList({
  title,
  items,
  empty,
  action
}: {
  title: string;
  empty: string;
  action?: ReactNode;
  items: Array<{ id: string; title: string; meta: string; href: string; status: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <SectionTitle title={title} action={action} />
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3 text-sm">
            <div className="min-w-0">
              <Link className="truncate font-medium text-primary hover:underline" href={item.href}>{item.title}</Link>
              <div className="truncate text-xs text-muted-foreground">{item.meta}</div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        )) : <SmallEmpty label={empty} />}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function formatEmployeeName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeNumber;
}

function getEmployeeStatus(employee: Employee) {
  if (employee.fireDate) {
    return { label: "Уволен", variant: "destructive" as const };
  }

  if (!employee.isActive) {
    return { label: "Неактивен", variant: "warning" as const };
  }

  return { label: "Активен", variant: "success" as const };
}

function formatTenure(hireDate?: string | null) {
  if (!hireDate) {
    return "-";
  }

  const start = new Date(hireDate);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
  const years = Math.floor(months / 12);
  const restMonths = months % 12;

  if (years <= 0) {
    return `${restMonths} мес.`;
  }

  return `${years} г. ${restMonths} мес.`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
