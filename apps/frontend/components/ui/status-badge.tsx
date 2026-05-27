import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  NEW: "Новый",
  MANAGER_PROCESSING: "В обработке",
  WAITING_PAYMENT: "Ждет оплату",
  PAID: "Оплачен",
  RESERVED: "Резерв",
  PICKING: "Сборка",
  SHIPPED: "Отгружен",
  DELIVERED: "Доставлен",
  COMPLETED: "Завершен",
  CANCELLED: "Отменен",
  REFUNDED: "Возврат",
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
  OPEN: "Открыт",
  CALCULATED: "Рассчитан",
  APPROVED: "Утвержден",
  CLOSED: "Закрыт",
  SUBMITTED: "На утверждении",
  REJECTED: "Отклонен",
  ACTIVE: "Активно",
  PAUSED: "Пауза",
  ARCHIVED: "Архив",
  PLANNED: "План",
  WORKED: "Отработано",
  MISSED: "Пропуск",
  LATE: "Опоздание",
  SICK: "Больничный",
  VACATION: "Отпуск",
  DAY_OFF: "Выходной",
  BONUS: "Бонус",
  PENALTY: "Штраф",
  CORRECTION: "Корректировка",
  PENDING: "Ожидает",
  FAILED: "Ошибка",
  SENT: "Отправлен"
};

const successStatuses = new Set(["PAID", "DELIVERED", "COMPLETED", "DONE", "APPROVED", "ACTIVE", "WORKED", "CALCULATED", "SENT"]);
const warningStatuses = new Set(["WAITING_PAYMENT", "PICKING", "SUBMITTED", "OPEN", "DRAFT", "PLANNED", "LATE", "PAUSED", "PENDING"]);
const destructiveStatuses = new Set(["CANCELLED", "REFUNDED", "REJECTED", "MISSED", "ARCHIVED", "FAILED"]);

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant: BadgeProps["variant"] = successStatuses.has(status)
    ? "success"
    : warningStatuses.has(status)
      ? "warning"
      : destructiveStatuses.has(status)
        ? "destructive"
        : "secondary";

  return <Badge className={className} variant={variant}>{statusLabels[status] ?? status}</Badge>;
}
