import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  HandCoins,
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
  { key: "overview", label: "Overview" },
  { key: "crm", label: "CRM" },
  { key: "finance", label: "Finance" },
  { key: "employees", label: "Employees" },
  { key: "admin", label: "Administration" }
];

export const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "analytics.read", icon: Gauge, group: "overview" },
  { label: "Analytics", href: "/analytics", permission: "analytics.read", icon: BarChart3, group: "overview" },

  { label: "Orders", href: "/orders", permission: "orders.read", icon: ClipboardList, group: "crm" },
  { label: "Customers", href: "/customers", permission: "customers.read", icon: Users, group: "crm" },
  { label: "Leads", href: "/leads", permission: "leads.read", icon: LayoutList, group: "crm" },
  { label: "Products", href: "/products", permission: "products.read", icon: Package, group: "crm" },
  { label: "Warehouse", href: "/warehouse", permission: "warehouse.read", icon: Warehouse, group: "crm" },

  { label: "Payments", href: "/payments", permission: "payments.read", icon: Landmark, group: "finance" },
  { label: "Documents", href: "/documents", permission: "documents.read", icon: FileText, group: "finance" },
  { label: "Payroll", href: "/payroll", permission: ["payroll.read", "payroll.manage"], icon: HandCoins, group: "finance" },
  {
    label: "Bonuses / penalties",
    href: "/payroll/adjustments",
    permission: ["payroll.read", "payroll.manage"],
    icon: ReceiptText,
    group: "finance"
  },
  {
    label: "Commission rules",
    href: "/payroll/commission-rules",
    permission: ["salary_rules.read", "salary_rules.manage"],
    icon: Percent,
    group: "finance"
  },

  { label: "Employees", href: "/employees", permission: "employees.read", icon: UserRoundCheck, group: "employees" },
  { label: "Tasks", href: "/tasks", permission: "tasks.read", icon: ReceiptText, group: "employees" },
  { label: "Employee tasks", href: "/employee-tasks", permission: "employee_tasks.read", icon: ClipboardCheck, group: "employees" },
  { label: "Responsibilities", href: "/responsibilities", permission: "responsibilities.read", icon: ListChecks, group: "employees" },
  {
    label: "Working time",
    href: "/attendance",
    permission: ["attendance.read", "attendance.manage", "attendance.own"],
    icon: Clock3,
    group: "employees"
  },
  {
    label: "Timesheet",
    href: "/attendance/timesheet",
    permission: ["attendance.read", "attendance.manage", "attendance.own"],
    icon: CalendarClock,
    group: "employees"
  },

  { label: "Users", href: "/admin/users", permission: "users.read", icon: UserCog, adminOnly: true, group: "admin" },
  { label: "Roles", href: "/admin/roles", permission: "roles.read", icon: ShieldCheck, adminOnly: true, group: "admin" },
  { label: "Settings", href: "/settings", icon: Settings, group: "admin" },
  { label: "Company Settings", href: "/admin/settings", permission: "settings.manage", icon: Settings, adminOnly: true, group: "admin" },
  { label: "Audit Logs", href: "/admin/audit-logs", permission: "audit_logs.read", icon: ScrollText, adminOnly: true, group: "admin" },
  { label: "Vault", href: "/secrets", permission: "secrets.read_metadata", icon: KeyRound, group: "admin" }
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
