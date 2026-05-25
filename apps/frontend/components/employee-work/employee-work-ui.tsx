"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Employee, UserOption } from "./employee-work-types";

export const taskStatuses = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const responsibilityStatuses = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export const assignmentRoles = ["OWNER", "BACKUP", "PARTICIPANT", "VIEWER"] as const;
export const secretTypes = ["LOGIN_PASSWORD", "API_KEY", "TOKEN", "CARD_INFO", "EMAIL_ACCOUNT", "TELEGRAM_ACCOUNT", "HOSTING", "OTHER"] as const;

export function Field({
  label,
  value,
  type = "text",
  required,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required={required} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  rows = 4,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function SelectField({
  label,
  value,
  children,
  onChange
}: {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

export function SelectEmployee({ employees, value, onChange }: { employees: Employee[]; value: string; onChange: (value: string) => void }) {
  return (
    <SelectField label="Сотрудник" value={value} onChange={onChange}>
      <option value="">Не выбран</option>
      {employees.map((employee) => (
        <option key={employee.id} value={employee.id}>
          {formatEmployee(employee)}
        </option>
      ))}
    </SelectField>
  );
}

export function SelectUser({ users, value, onChange }: { users: UserOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <SelectField label="Пользователь" value={value} onChange={onChange}>
      <option value="">Не выбран</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} / {user.email}
        </option>
      ))}
    </SelectField>
  );
}

export function formatEmployee(employee?: Employee | null) {
  if (!employee) {
    return "-";
  }

  return `${employee.lastName} ${employee.firstName}`.trim() || employee.employeeNumber;
}

export function formatUser(user?: UserOption | null) {
  return user ? `${user.name} / ${user.email}` : "-";
}

export function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}

export function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
}

export function shortText(value?: string | null, fallback = "-") {
  if (!value) {
    return fallback;
  }

  return value.length > 100 ? `${value.slice(0, 100)}...` : value;
}
