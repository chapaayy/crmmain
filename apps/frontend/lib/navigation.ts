import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  HandCoins,
  Home,
  KeyRound,
  Landmark,
  LayoutList,
  ListChecks,
  Package,
  Percent,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  Users,
  Warehouse
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuGroupKey = "overview" | "crm" | "finance" | "employees" | "admin";

export interface MenuItem {
  label: string;
  href: string;
  permission?: string | string[];
  icon: LucideIcon;
  adminOnly?: boolean;
  group: MenuGroupKey;
}

export const menuGroups: Array<{ key: MenuGroupKey; label: string }> = [
  { key: "overview", label: "Обзор" },
  { key: "crm", label: "CRM" },
  { key: "finance", label: "Финансы" },
  { key: "employees", label: "Сотрудники" },
  { key: "admin", label: "Администрирование" }
];

export const menuItems: MenuItem[] = [
  { label: "Главная", href: "/home", icon: Home, group: "overview" },
  { label: "Аналитика", href: "/dashboard", permission: "analytics.read", icon: BarChart3, group: "overview" },

  { label: "Заказы", href: "/orders", permission: "orders.read", icon: ClipboardList, group: "crm" },
  { label: "Клиенты", href: "/customers", permission: "customers.read", icon: Users, group: "crm" },
  { label: "Лиды", href: "/leads", permission: "leads.read", icon: LayoutList, group: "crm" },
  { label: "Товары", href: "/products", permission: "products.read", icon: Package, group: "crm" },
  { label: "Склад", href: "/warehouse", permission: "warehouse.read", icon: Warehouse, group: "crm" },

  { label: "Оплаты", href: "/payments", permission: "payments.read", icon: Landmark, group: "finance" },
  { label: "Документы", href: "/documents", permission: "documents.read", icon: FileText, group: "finance" },
  { label: "Зарплата", href: "/payroll", permission: ["payroll.read", "payroll.manage"], icon: HandCoins, group: "finance" },
  {
    label: "Бонусы / штрафы",
    href: "/payroll/adjustments",
    permission: ["payroll.read", "payroll.manage"],
    icon: ReceiptText,
    group: "finance"
  },
  {
    label: "Правила комиссий",
    href: "/payroll/commission-rules",
    permission: ["salary_rules.read", "salary_rules.manage"],
    icon: Percent,
    group: "finance"
  },

  { label: "Сотрудники", href: "/employees", permission: "employees.read", icon: UserRoundCheck, group: "employees" },
  { label: "Задачи", href: "/tasks", permission: "tasks.read", icon: ReceiptText, group: "employees" },
  { label: "Задачи сотрудников", href: "/employee-tasks", permission: "employee_tasks.read", icon: ClipboardCheck, group: "employees" },
  { label: "Ответственности", href: "/responsibilities", permission: "responsibilities.read", icon: ListChecks, group: "employees" },
  {
    label: "Рабочее время",
    href: "/attendance",
    permission: ["attendance.read", "attendance.manage", "attendance.own"],
    icon: Clock3,
    group: "employees"
  },
  {
    label: "Табель",
    href: "/attendance/timesheet",
    permission: ["attendance.read", "attendance.manage", "attendance.own"],
    icon: CalendarClock,
    group: "employees"
  },

  { label: "Пользователи", href: "/admin/users", permission: "users.read", icon: UserCog, adminOnly: true, group: "admin" },
  { label: "Роли", href: "/admin/roles", permission: "roles.read", icon: ShieldCheck, adminOnly: true, group: "admin" },
  { label: "Настройки", href: "/settings", icon: Settings, group: "admin" },
  { label: "Настройки компании", href: "/admin/settings", permission: "settings.manage", icon: Settings, adminOnly: true, group: "admin" },
  { label: "Audit Logs", href: "/admin/audit-logs", permission: "audit_logs.read", icon: ScrollText, adminOnly: true, group: "admin" },
  { label: "Доступы / Vault", href: "/secrets", permission: "secrets.read_metadata", icon: KeyRound, group: "admin" }
];

export const sectionMeta = new Map(
  menuItems
    .filter((item) => item.href !== "/")
    .map((item) => [
      item.href.slice(1),
      {
        title: item.label,
        permission: item.permission,
        adminOnly: item.adminOnly ?? false
      }
    ])
);
