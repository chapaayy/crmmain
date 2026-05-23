import {
  BarChart3,
  ClipboardList,
  FileText,
  Gauge,
  Landmark,
  LayoutList,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Warehouse,
  UserCog,
  ScrollText
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  href: string;
  permission?: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", permission: "analytics.read", icon: Gauge },
  { label: "Orders", href: "/orders", permission: "orders.read", icon: ClipboardList },
  { label: "Customers", href: "/customers", permission: "customers.read", icon: Users },
  { label: "Leads", href: "/leads", permission: "leads.read", icon: LayoutList },
  { label: "Products", href: "/products", permission: "products.read", icon: Package },
  { label: "Warehouse", href: "/warehouse", permission: "warehouse.read", icon: Warehouse },
  { label: "Payments", href: "/payments", permission: "payments.read", icon: Landmark },
  { label: "Documents", href: "/documents", permission: "documents.read", icon: FileText },
  { label: "Tasks", href: "/tasks", permission: "tasks.read", icon: ReceiptText },
  { label: "Analytics", href: "/analytics", permission: "analytics.read", icon: BarChart3 },
  { label: "My Settings", href: "/settings", icon: Settings },
  { label: "Users", href: "/admin/users", permission: "users.read", icon: UserCog, adminOnly: true },
  { label: "Roles", href: "/admin/roles", permission: "roles.read", icon: ShieldCheck, adminOnly: true },
  { label: "Company Settings", href: "/admin/settings", permission: "settings.manage", icon: Settings, adminOnly: true },
  { label: "Audit Logs", href: "/admin/audit-logs", permission: "audit_logs.read", icon: ScrollText, adminOnly: true }
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
