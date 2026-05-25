"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function LoadingRow({ colSpan, label = "Загрузка" }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={colSpan}>
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
        {label}
      </td>
    </tr>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = ["APPROVED", "PAID", "WORKED", "ACTIVE", "CALCULATED"].includes(status)
    ? "success"
    : ["REJECTED", "CANCELLED", "MISSED", "REFUNDED"].includes(status)
      ? "warning"
      : ["SUBMITTED", "OPEN", "DRAFT", "PLANNED"].includes(status)
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{statusLabels[status] ?? status}</Badge>;
}

export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function formatNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2
  }).format(Number(value));
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function toInputDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function compactPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined)
  );
}

const statusLabels: Record<string, string> = {
  FULL_TIME: "Полная занятость",
  PART_TIME: "Частичная",
  CONTRACTOR: "Подрядчик",
  INTERN: "Стажер",
  OTHER: "Другое",
  OPEN: "Открыт",
  CALCULATED: "Рассчитан",
  APPROVED: "Утвержден",
  PAID: "Выплачен",
  CLOSED: "Закрыт",
  CANCELLED: "Отменен",
  DRAFT: "Черновик",
  SUBMITTED: "На утверждении",
  REJECTED: "Отклонен",
  PLANNED: "План",
  WORKED: "Отработано",
  MISSED: "Пропуск",
  LATE: "Опоздание",
  SICK: "Больничный",
  VACATION: "Отпуск",
  DAY_OFF: "Выходной",
  BONUS: "Бонус",
  PENALTY: "Штраф",
  CORRECTION: "Корректировка"
};
