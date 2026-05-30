import type { PaginatedResponse } from "@/components/admin/admin-types";

export type { PaginatedResponse };

export interface UserOption {
  id: string;
  email: string;
  name: string;
  primaryRole?: string;
  isActive?: boolean;
}

export interface Employee {
  id: string;
  userId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  department?: string | null;
  employmentType: string;
  hireDate?: string | null;
  fireDate?: string | null;
  baseSalary?: string | number | null;
  hourlyRate?: string | number | null;
  shiftRate?: string | number | null;
  commissionRate?: string | number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: UserOption;
  schedules?: WorkSchedule[];
  payrollLines?: PayrollLine[];
  _count?: {
    timeEntries?: number;
    shifts?: number;
    payrollLines?: number;
  };
}

export interface WorkSchedule {
  id: string;
  employeeId: string;
  name: string;
  type: string;
  workdayHours: string | number;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone: string;
  isActive: boolean;
}

export interface WorkShift {
  id: string;
  employeeId: string;
  scheduleId?: string | null;
  date: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: string;
  comment?: string | null;
  employee?: Employee;
  schedule?: WorkSchedule | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string;
  startedAt: string;
  endedAt?: string | null;
  breakMinutes: number;
  totalMinutes: number;
  source: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  status: string;
  comment?: string | null;
  employee?: Employee;
}

export interface PayrollPeriod {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  periodId: string;
  status: string;
  calculatedAt?: string | null;
  approvedAt?: string | null;
  totalGross: string | number;
  totalBonuses: string | number;
  totalPenalties: string | number;
  totalCommissions: string | number;
  totalNet: string | number;
  period: PayrollPeriod;
  lines?: PayrollLine[];
  _count?: {
    lines?: number;
  };
}

export interface PayrollLine {
  id: string;
  employeeId: string;
  baseSalaryAmount: string | number;
  hourlyAmount: string | number;
  shiftAmount: string | number;
  overtimeAmount: string | number;
  bonusAmount: string | number;
  penaltyAmount: string | number;
  commissionAmount: string | number;
  grossAmount: string | number;
  netAmount: string | number;
  workedHours: string | number;
  workedDays: string | number;
  overtimeHours: string | number;
  comment?: string | null;
  employee: Employee;
  payrollRun?: PayrollRun;
}

export interface PayrollAdjustment {
  id: string;
  employeeId: string;
  periodId: string;
  type: string;
  amount: string | number;
  reason: string;
  employee?: Employee;
  period?: PayrollPeriod;
}
