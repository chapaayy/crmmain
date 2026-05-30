const defaultRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "Главный администратор",
  ADMIN: "Администратор",
  HR_MANAGER: "HR-менеджер",
  PAYROLL_MANAGER: "Менеджер зарплаты",
  SALES_MANAGER: "Менеджер продаж",
  WAREHOUSE_MANAGER: "Менеджер склада",
  ACCOUNTANT: "Бухгалтер",
  VIEWER: "Наблюдатель"
};

const defaultRoleColors: Record<string, string> = {
  SUPER_ADMIN: "#22D3EE",
  ADMIN: "#14B8A6",
  HR_MANAGER: "#8B5CF6",
  PAYROLL_MANAGER: "#F59E0B",
  SALES_MANAGER: "#38BDF8",
  WAREHOUSE_MANAGER: "#10B981",
  ACCOUNTANT: "#F97316",
  VIEWER: "#94A3B8"
};

type RoleLike =
  | string
  | {
      code?: string | null;
      name?: string | null;
      color?: string | null;
    }
  | null
  | undefined;

export function getRoleCode(role: RoleLike) {
  if (typeof role === "string") {
    return role;
  }

  return role?.code ?? "";
}

export function getRoleDisplayName(role: RoleLike) {
  if (typeof role === "string") {
    return defaultRoleLabels[role] ?? role;
  }

  const code = role?.code ?? "";
  const name = role?.name?.trim();

  if (!name || name === code) {
    return defaultRoleLabels[code] ?? code;
  }

  return name;
}

export function normalizeRoleColor(color?: string | null, code?: string | null) {
  if (color && /^#([0-9A-Fa-f]{6})$/.test(color)) {
    return color.toUpperCase();
  }

  return defaultRoleColors[code ?? ""] ?? "#22D3EE";
}

export function getRoleBadgeStyle(role: RoleLike) {
  const code = getRoleCode(role);
  const color = normalizeRoleColor(typeof role === "string" ? null : role?.color, code);

  return {
    color,
    borderColor: withAlpha(color, 0.38),
    backgroundColor: withAlpha(color, 0.12),
    boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.08)}`
  };
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = normalizeRoleColor(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
