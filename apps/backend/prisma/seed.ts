import {
  BagBottomType,
  BagTopType,
  BagType,
  CustomerStatus,
  CustomerType,
  DiscountType,
  CommissionSource,
  EmploymentType,
  LeadStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayrollAdjustmentType,
  PayrollPeriodStatus,
  PayrollRunStatus,
  Prisma,
  PrismaClient,
  RoleCode,
  StockMovementType,
  TimeEntrySource,
  TimeEntryStatus,
  WorkScheduleType,
  WorkShiftStatus
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const permissions = [
  ["users.read", "Read users", "users", "read"],
  ["users.create", "Create users", "users", "create"],
  ["users.update", "Update users", "users", "update"],
  ["users.delete", "Delete users", "users", "delete"],
  ["roles.read", "Read roles", "roles", "read"],
  ["roles.manage", "Manage roles", "roles", "manage"],
  ["customers.read", "Read customers", "customers", "read"],
  ["customers.create", "Create customers", "customers", "create"],
  ["customers.update", "Update customers", "customers", "update"],
  ["customers.delete", "Delete customers", "customers", "delete"],
  ["leads.read", "Read leads", "leads", "read"],
  ["leads.create", "Create leads", "leads", "create"],
  ["leads.update", "Update leads", "leads", "update"],
  ["leads.delete", "Delete leads", "leads", "delete"],
  ["products.read", "Read products", "products", "read"],
  ["products.create", "Create products", "products", "create"],
  ["products.update", "Update products", "products", "update"],
  ["products.delete", "Delete products", "products", "delete"],
  ["orders.read", "Read orders", "orders", "read"],
  ["orders.create", "Create orders", "orders", "create"],
  ["orders.update", "Update orders", "orders", "update"],
  ["orders.change_status", "Change order status", "orders", "change_status"],
  ["warehouse.read", "Read warehouse", "warehouse", "read"],
  ["warehouse.manage", "Manage warehouse", "warehouse", "manage"],
  ["payments.read", "Read payments", "payments", "read"],
  ["payments.manage", "Manage payments", "payments", "manage"],
  ["documents.read", "Read documents", "documents", "read"],
  ["documents.manage", "Manage documents", "documents", "manage"],
  ["tasks.read", "Read tasks", "tasks", "read"],
  ["tasks.create", "Create tasks", "tasks", "create"],
  ["tasks.update", "Update tasks", "tasks", "update"],
  ["tasks.delete", "Delete tasks", "tasks", "delete"],
  ["analytics.read", "Read analytics", "analytics", "read"],
  ["analytics.read_finance", "Read financial analytics", "analytics", "read_finance"],
  ["settings.manage", "Manage settings", "settings", "manage"],
  ["audit_logs.read", "Read audit logs", "audit_logs", "read"],
  ["employees.read", "Read employees", "employees", "read"],
  ["employees.create", "Create employees", "employees", "create"],
  ["employees.update", "Update employees", "employees", "update"],
  ["employees.delete", "Delete employees", "employees", "delete"],
  ["attendance.read", "Read attendance", "attendance", "read"],
  ["attendance.manage", "Manage attendance", "attendance", "manage"],
  ["attendance.own", "Read own attendance", "attendance", "own"],
  ["payroll.read", "Read payroll", "payroll", "read"],
  ["payroll.manage", "Manage payroll", "payroll", "manage"],
  ["payroll.approve", "Approve payroll", "payroll", "approve"],
  ["payroll.export", "Export payroll", "payroll", "export"],
  ["salary_rules.read", "Read salary rules", "salary_rules", "read"],
  ["salary_rules.manage", "Manage salary rules", "salary_rules", "manage"]
] as const;

const roleDescriptions: Record<RoleCode, string> = {
  SUPER_ADMIN: "Full system access with all permissions.",
  ADMIN: "Administrative access for CRM configuration and user management.",
  HR_MANAGER: "Employee profiles, schedules, attendance, and payroll preparation.",
  PAYROLL_MANAGER: "Payroll calculation, salary rules, approvals, and exports.",
  SALES_MANAGER: "Sales pipeline, customers, leads, orders, documents, and tasks.",
  WAREHOUSE_MANAGER: "Warehouse, stock, product, and shipment operations.",
  ACCOUNTANT: "Payments, invoices, documents, and order finance visibility.",
  VIEWER: "Read-only access to operational data."
};

const defaultProductCategories = [
  ["meshki-polipropilenovye", "мешки полипропиленовые"],
  ["meshki-dlya-musora", "мешки для мусора"],
  ["meshki-dlya-peska", "мешки для песка"],
  ["meshki-dlya-zerna", "мешки для зерна"],
  ["meshki-prozrachnye", "мешки прозрачные"],
  ["meshki-s-ruchkami", "мешки с ручками"],
  ["meshki-s-vkladyshem", "мешки с вкладышем"],
  ["big-begi", "биг-бэги"],
  ["bu-big-begi", "б/у биг-бэги"]
] as const;

const adminPermissionKeys = ["users.read", "roles.read", "audit_logs.read"];
const hiddenReadPermissionKeys = ["payroll.read", "salary_rules.read"];
const readPermissions = permissions
  .map(([key]) => key)
  .filter((key) => key.endsWith(".read") && !adminPermissionKeys.includes(key) && !hiddenReadPermissionKeys.includes(key));
const permissionKeys = permissions.map(([key]) => key);

const rolePermissionKeys: Record<RoleCode, string[]> = {
  SUPER_ADMIN: permissions.map(([key]) => key),
  ADMIN: permissions.map(([key]) => key),
  HR_MANAGER: [
    "employees.read",
    "employees.create",
    "employees.update",
    "employees.delete",
    "attendance.read",
    "attendance.manage",
    "attendance.own",
    "payroll.read",
    "payroll.manage",
    "salary_rules.read"
  ],
  PAYROLL_MANAGER: [
    "payroll.read",
    "payroll.manage",
    "payroll.approve",
    "payroll.export",
    "salary_rules.read",
    "salary_rules.manage",
    "attendance.read",
    "employees.read"
  ],
  SALES_MANAGER: [
    "customers.read",
    "customers.create",
    "customers.update",
    "leads.read",
    "leads.create",
    "leads.update",
    "products.read",
    "orders.read",
    "orders.create",
    "orders.update",
    "orders.change_status",
    "documents.read",
    "documents.manage",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "attendance.own",
    "analytics.read"
  ],
  WAREHOUSE_MANAGER: [
    "products.read",
    "products.update",
    "warehouse.read",
    "warehouse.manage",
    "orders.read",
    "orders.change_status",
    "documents.read",
    "tasks.read",
    "tasks.create",
    "tasks.update"
  ],
  ACCOUNTANT: [
    "customers.read",
    "orders.read",
    "payments.read",
    "payments.manage",
    "payroll.read",
    "payroll.manage",
    "payroll.export",
    "employees.read",
    "documents.read",
    "documents.manage",
    "tasks.read",
    "analytics.read",
    "analytics.read_finance"
  ],
  VIEWER: readPermissions
};

function splitName(name: string) {
  const [firstName, ...rest] = name.trim().split(/\s+/);

  return {
    firstName: firstName || undefined,
    lastName: rest.length ? rest.join(" ") : undefined
  };
}

interface DemoProductSeed {
  sku: string;
  variantSku: string;
  name: string;
  categoryId: string;
  size: string;
  density: string;
  color: string;
  bagType: BagType;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  minOrderQty: number;
  packageQty: number;
  stockQuantity: number;
  reservedQuantity: number;
  hasLiner?: boolean;
  capacity?: string;
  topType?: BagTopType;
  bottomType?: BagBottomType;
}

interface DemoProductRecord extends DemoProductSeed {
  product: {
    id: string;
    sku: string;
    name: string;
  };
  variant: {
    id: string;
    sku: string;
    name: string;
  };
}

async function seedPermissions() {
  const created = new Map<string, string>();

  for (const [key, name, resource, action] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {
        name,
        resource,
        action,
        deletedAt: null
      },
      create: {
        key,
        name,
        resource,
        action
      }
    });

    created.set(permission.key, permission.id);
  }

  return created;
}

async function seedRoles() {
  const created = new Map<RoleCode, string>();

  for (const code of Object.values(RoleCode)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {
        name: code,
        description: roleDescriptions[code],
        isSystem: true,
        deletedAt: null
      },
      create: {
        code,
        name: code,
        description: roleDescriptions[code],
        isSystem: true
      }
    });

    created.set(code, role.id);
  }

  return created;
}

async function assignPermissions(roleIds: Map<RoleCode, string>, permissionIds: Map<string, string>) {
  for (const [roleCode, keys] of Object.entries(rolePermissionKeys) as [RoleCode, string[]][]) {
    const roleId = roleIds.get(roleCode);

    if (!roleId) {
      continue;
    }

    const desiredPermissionIds = keys
      .map((key) => permissionIds.get(key))
      .filter((permissionId): permissionId is string => Boolean(permissionId));

    await prisma.rolePermission.updateMany({
      where: {
        roleId,
        permissionId: { notIn: desiredPermissionIds },
        deletedAt: null
      },
      data: {
        deletedAt: new Date()
      }
    });

    for (const key of keys) {
      const permissionId = permissionIds.get(key);

      if (!permissionId) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId
          }
        },
        update: {
          deletedAt: null
        },
        create: {
          roleId,
          permissionId
        }
      });
    }
  }
}

async function seedSuperAdmin(roleIds: Map<RoleCode, string>) {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    console.warn("Super admin seed skipped: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing.");
    return undefined;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { firstName, lastName } = splitName(name);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      firstName,
      lastName,
      passwordHash,
      primaryRole: RoleCode.SUPER_ADMIN,
      isActive: true,
      deletedAt: null
    },
    create: {
      email,
      passwordHash,
      name,
      firstName,
      lastName,
      locale: "ru",
      primaryRole: RoleCode.SUPER_ADMIN
    }
  });
  const superAdminRoleId = roleIds.get(RoleCode.SUPER_ADMIN);

  if (superAdminRoleId) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: superAdminRoleId
        }
      },
      update: {
        assignedById: user.id,
        deletedAt: null
      },
      create: {
        userId: user.id,
        roleId: superAdminRoleId,
        assignedById: user.id
      }
    });
  }

  return user.id;
}

async function seedProductCategories() {
  for (const [slug, name] of defaultProductCategories) {
    await prisma.productCategory.upsert({
      where: { slug },
      update: {
        name,
        deletedAt: null
      },
      create: {
        slug,
        name
      }
    });
  }
}

async function seedDemoData(actorId?: string) {
  const categoryNames = new Map([
    ["meshki-polipropilenovye", "Polypropylene bags"],
    ["meshki-dlya-musora", "Garbage bags"],
    ["meshki-dlya-peska", "Sand bags"],
    ["meshki-dlya-zerna", "Grain bags"],
    ["meshki-prozrachnye", "Transparent bags"],
    ["meshki-s-ruchkami", "Bags with handles"],
    ["meshki-s-vkladyshem", "Bags with liner"],
    ["big-begi", "Big bags"],
    ["bu-big-begi", "Used big bags"]
  ]);

  for (const [slug, name] of categoryNames) {
    await prisma.productCategory.update({
      where: { slug },
      data: { name }
    });
  }

  const categories = await prisma.productCategory.findMany({
    where: {
      slug: {
        in: defaultProductCategories.map(([slug]) => slug)
      }
    },
    select: {
      id: true,
      slug: true
    }
  });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const ppCategoryId = categoryBySlug.get("meshki-polipropilenovye");
  const linerCategoryId = categoryBySlug.get("meshki-s-vkladyshem");
  const bigBagCategoryId = categoryBySlug.get("big-begi");

  if (!ppCategoryId || !linerCategoryId || !bigBagCategoryId) {
    throw new Error("Demo categories were not created");
  }

  const products: DemoProductSeed[] = [
    {
      sku: "PP-55X105-70-W",
      variantSku: "PP-55X105-70-W-1000",
      name: "PP bag 55x105 70 gsm white",
      categoryId: ppCategoryId,
      size: "55x105 cm",
      density: "70 gsm",
      color: "white",
      bagType: BagType.POLYPROPYLENE_BAG,
      purchasePrice: 8.2,
      retailPrice: 14.5,
      wholesalePrice: 12.5,
      minOrderQty: 500,
      packageQty: 1000,
      stockQuantity: 2500,
      reservedQuantity: 100
    },
    {
      sku: "PP-LINER-60X110",
      variantSku: "PP-LINER-60X110-500",
      name: "PP bag with liner 60x110",
      categoryId: linerCategoryId,
      size: "60x110 cm",
      density: "85 gsm",
      color: "white",
      bagType: BagType.LINER_BAG,
      purchasePrice: 16,
      retailPrice: 25,
      wholesalePrice: 21,
      minOrderQty: 300,
      packageQty: 500,
      stockQuantity: 800,
      reservedQuantity: 0,
      hasLiner: true
    },
    {
      sku: "BB-90X90X120-4L",
      variantSku: "BB-90X90X120-4L-STD",
      name: "Big bag 90x90x120 four loops",
      categoryId: bigBagCategoryId,
      size: "90x90x120 cm",
      density: "160 gsm",
      color: "white",
      bagType: BagType.BIG_BAG,
      purchasePrice: 390,
      retailPrice: 650,
      wholesalePrice: 550,
      minOrderQty: 10,
      packageQty: 20,
      stockQuantity: 75,
      reservedQuantity: 5,
      capacity: "1000 kg",
      topType: BagTopType.OPEN_TOP,
      bottomType: BagBottomType.FLAT
    }
  ];
  const variants: DemoProductRecord[] = [];

  for (const productInput of products) {
    const product = await prisma.product.upsert({
      where: { sku: productInput.sku },
      update: {
        name: productInput.name,
        categoryId: productInput.categoryId,
        size: productInput.size,
        density: productInput.density,
        color: productInput.color,
        bagType: productInput.bagType,
        purchasePrice: decimal(productInput.purchasePrice),
        retailPrice: decimal(productInput.retailPrice),
        wholesalePrice: decimal(productInput.wholesalePrice),
        minOrderQty: productInput.minOrderQty,
        packageQty: productInput.packageQty,
        hasLiner: productInput.hasLiner ?? false,
        hasHandles: false,
        capacity: productInput.capacity,
        topType: productInput.topType,
        bottomType: productInput.bottomType,
        isActive: true,
        deletedAt: null,
        updatedById: actorId
      },
      create: {
        sku: productInput.sku,
        name: productInput.name,
        categoryId: productInput.categoryId,
        description: "Demo product seeded for CRM quickstart.",
        size: productInput.size,
        density: productInput.density,
        color: productInput.color,
        material: "polypropylene",
        bagType: productInput.bagType,
        capacity: productInput.capacity,
        hasLiner: productInput.hasLiner ?? false,
        hasHandles: false,
        topType: productInput.topType,
        bottomType: productInput.bottomType,
        minOrderQty: productInput.minOrderQty,
        packageQty: productInput.packageQty,
        purchasePrice: decimal(productInput.purchasePrice),
        retailPrice: decimal(productInput.retailPrice),
        wholesalePrice: decimal(productInput.wholesalePrice),
        isCustomOrderAvailable: true,
        isActive: true,
        createdById: actorId,
        updatedById: actorId
      }
    });
    const variant = await prisma.productVariant.upsert({
      where: { sku: productInput.variantSku },
      update: {
        productId: product.id,
        name: `${productInput.name} / standard pack`,
        categoryId: productInput.categoryId,
        size: productInput.size,
        density: productInput.density,
        color: productInput.color,
        bagType: productInput.bagType,
        purchasePrice: decimal(productInput.purchasePrice),
        retailPrice: decimal(productInput.retailPrice),
        wholesalePrice: decimal(productInput.wholesalePrice),
        minOrderQty: productInput.minOrderQty,
        packageQty: productInput.packageQty,
        hasLiner: productInput.hasLiner ?? false,
        hasHandles: false,
        capacity: productInput.capacity,
        topType: productInput.topType,
        bottomType: productInput.bottomType,
        isActive: true,
        deletedAt: null,
        updatedById: actorId
      },
      create: {
        productId: product.id,
        sku: productInput.variantSku,
        name: `${productInput.name} / standard pack`,
        categoryId: productInput.categoryId,
        description: "Demo variant seeded for stock and order flows.",
        size: productInput.size,
        density: productInput.density,
        color: productInput.color,
        material: "polypropylene",
        bagType: productInput.bagType,
        capacity: productInput.capacity,
        hasLiner: productInput.hasLiner ?? false,
        hasHandles: false,
        topType: productInput.topType,
        bottomType: productInput.bottomType,
        minOrderQty: productInput.minOrderQty,
        packageQty: productInput.packageQty,
        purchasePrice: decimal(productInput.purchasePrice),
        retailPrice: decimal(productInput.retailPrice),
        wholesalePrice: decimal(productInput.wholesalePrice),
        isCustomOrderAvailable: true,
        isActive: true,
        createdById: actorId,
        updatedById: actorId
      }
    });

    variants.push({ ...productInput, product, variant });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {
      name: "Main warehouse",
      address: "Demo warehouse address",
      isActive: true,
      managerId: actorId,
      deletedAt: null,
      updatedById: actorId
    },
    create: {
      code: "MAIN",
      name: "Main warehouse",
      address: "Demo warehouse address",
      isActive: true,
      managerId: actorId,
      createdById: actorId,
      updatedById: actorId
    }
  });

  await prisma.stockMovement.deleteMany({
    where: {
      reference: {
        in: ["DEMO-RECEIPT", "DEMO-RESERVE-001"]
      }
    }
  });

  for (const item of variants) {
    const stockItem = await prisma.stockItem.upsert({
      where: {
        warehouseId_productId_variantId: {
          warehouseId: warehouse.id,
          productId: item.product.id,
          variantId: item.variant.id
        }
      },
      update: {
        quantity: decimal(item.stockQuantity),
        reservedQuantity: decimal(item.reservedQuantity),
        unit: "pcs",
        deletedAt: null,
        updatedById: actorId
      },
      create: {
        warehouseId: warehouse.id,
        productId: item.product.id,
        variantId: item.variant.id,
        quantity: decimal(item.stockQuantity),
        reservedQuantity: decimal(item.reservedQuantity),
        unit: "pcs",
        createdById: actorId,
        updatedById: actorId
      }
    });

    await prisma.stockMovement.create({
      data: {
        type: StockMovementType.RECEIPT,
        warehouseId: warehouse.id,
        stockItemId: stockItem.id,
        productId: item.product.id,
        variantId: item.variant.id,
        quantity: decimal(item.stockQuantity),
        unit: "pcs",
        balanceBefore: decimal(0),
        balanceAfter: decimal(item.stockQuantity),
        reference: "DEMO-RECEIPT",
        note: "Demo opening stock",
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  const customer = await prisma.customer.upsert({
    where: { code: "DEMO-CUST-AGRO" },
    update: {
      type: CustomerType.COMPANY,
      name: "AgroPack Demo",
      companyName: "AgroPack Demo LLC",
      inn: "7700000001",
      kpp: "770001001",
      ogrn: "1027700000001",
      legalAddress: "Demo legal address",
      deliveryAddress: "Demo delivery address",
      phone: "+1-555-0101",
      email: "buyer@example.com",
      source: "website",
      segment: "agriculture",
      status: CustomerStatus.ACTIVE,
      ownerId: actorId,
      notes: "Demo customer for CRM quickstart.",
      deletedAt: null,
      updatedById: actorId
    },
    create: {
      code: "DEMO-CUST-AGRO",
      type: CustomerType.COMPANY,
      name: "AgroPack Demo",
      companyName: "AgroPack Demo LLC",
      inn: "7700000001",
      kpp: "770001001",
      ogrn: "1027700000001",
      legalAddress: "Demo legal address",
      deliveryAddress: "Demo delivery address",
      phone: "+1-555-0101",
      email: "buyer@example.com",
      messengers: { telegram: "@agropack_demo" },
      source: "website",
      segment: "agriculture",
      status: CustomerStatus.ACTIVE,
      ownerId: actorId,
      notes: "Demo customer for CRM quickstart.",
      createdById: actorId,
      updatedById: actorId
    }
  });
  const contact = await prisma.customerContact.findFirst({
    where: {
      customerId: customer.id,
      email: "buyer@example.com",
      deletedAt: null
    },
    select: { id: true }
  });

  if (!contact) {
    await prisma.customerContact.create({
      data: {
        customerId: customer.id,
        fullName: "Ivan Buyer",
        position: "Procurement manager",
        phone: "+1-555-0101",
        email: "buyer@example.com",
        isPrimary: true,
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  const lead = await prisma.lead.upsert({
    where: { number: "LEAD-DEMO-001" },
    update: {
      title: "Repeat order for PP bags",
      phone: "+1-555-0102",
      email: "lead@example.com",
      status: LeadStatus.QUALIFIED,
      source: "website",
      interestedProducts: ["PP bags", "Big bags"],
      assignedToId: actorId,
      estimatedValue: decimal(18000),
      nextContactAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      comment: "Demo lead seeded for sales pipeline.",
      deletedAt: null,
      updatedById: actorId
    },
    create: {
      number: "LEAD-DEMO-001",
      title: "Repeat order for PP bags",
      phone: "+1-555-0102",
      email: "lead@example.com",
      status: LeadStatus.QUALIFIED,
      source: "website",
      interestedProducts: ["PP bags", "Big bags"],
      assignedToId: actorId,
      estimatedValue: decimal(18000),
      nextContactAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      comment: "Demo lead seeded for sales pipeline.",
      createdById: actorId,
      updatedById: actorId
    }
  });
  const orderLines = [
    {
      product: variants[0].product,
      variant: variants[0].variant,
      quantity: 300,
      unitPrice: 12.5,
      discount: 0
    },
    {
      product: variants[2].product,
      variant: variants[2].variant,
      quantity: 20,
      unitPrice: 550,
      discount: 0
    }
  ];
  const subtotal = roundMoney(orderLines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount, 0));
  const discountValue = 5;
  const discount = roundMoney((subtotal * discountValue) / 100);
  const taxable = roundMoney(subtotal - discount);
  const taxRate = 20;
  const tax = roundMoney((taxable * taxRate) / 100);
  const total = roundMoney(taxable + tax);
  const paidAmount = 10000;
  const order = await prisma.order.upsert({
    where: { number: "ORD-DEMO-001" },
    update: {
      status: OrderStatus.RESERVED,
      customerId: customer.id,
      leadId: lead.id,
      managerId: actorId,
      warehouseId: warehouse.id,
      currency: "RUB",
      subtotal: decimal(subtotal),
      discountType: DiscountType.PERCENT,
      discountValue: decimal(discountValue),
      discount: decimal(discount),
      taxRate: decimal(taxRate),
      tax: decimal(tax),
      total: decimal(total),
      paidAmount: decimal(paidAmount),
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      notes: "Demo order with backend-calculated totals.",
      deletedAt: null,
      updatedById: actorId
    },
    create: {
      number: "ORD-DEMO-001",
      status: OrderStatus.RESERVED,
      customerId: customer.id,
      leadId: lead.id,
      managerId: actorId,
      warehouseId: warehouse.id,
      currency: "RUB",
      subtotal: decimal(subtotal),
      discountType: DiscountType.PERCENT,
      discountValue: decimal(discountValue),
      discount: decimal(discount),
      taxRate: decimal(taxRate),
      tax: decimal(tax),
      total: decimal(total),
      paidAmount: decimal(paidAmount),
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      notes: "Demo order with backend-calculated totals.",
      createdById: actorId,
      updatedById: actorId
    }
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id, externalId: "DEMO-PAY-001" } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });

  for (const line of orderLines) {
    const lineTotal = roundMoney(line.quantity * line.unitPrice - line.discount);

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: line.product.id,
        variantId: line.variant.id,
        sku: line.variant.sku,
        name: line.variant.name,
        quantity: decimal(line.quantity),
        unit: "pcs",
        unitPrice: decimal(line.unitPrice),
        discount: decimal(line.discount),
        total: decimal(lineTotal)
      }
    });
  }

  await prisma.payment.create({
    data: {
      orderId: order.id,
      status: PaymentStatus.PAID,
      method: PaymentMethod.BANK_TRANSFER,
      amount: decimal(paidAmount),
      currency: "RUB",
      paidAt: new Date(),
      externalId: "DEMO-PAY-001",
      note: "Demo partial payment",
      createdById: actorId,
      updatedById: actorId
    }
  });
  await prisma.orderStatusHistory.createMany({
    data: [
      {
        orderId: order.id,
        previousStatus: null,
        status: OrderStatus.DRAFT,
        comment: "Demo order created",
        changedById: actorId
      },
      {
        orderId: order.id,
        previousStatus: OrderStatus.DRAFT,
        status: OrderStatus.RESERVED,
        comment: "Demo stock reserved",
        changedById: actorId
      }
    ]
  });
  await prisma.stockMovement.create({
    data: {
      type: StockMovementType.RESERVATION,
      warehouseId: warehouse.id,
      stockItemId: (await prisma.stockItem.findFirstOrThrow({
        where: {
          warehouseId: warehouse.id,
          variantId: variants[0].variant.id,
          deletedAt: null
        },
        select: { id: true }
      })).id,
      productId: variants[0].product.id,
      variantId: variants[0].variant.id,
      orderId: order.id,
      quantity: decimal(100),
      unit: "pcs",
      balanceBefore: decimal(0),
      balanceAfter: decimal(100),
      reference: "DEMO-RESERVE-001",
      note: "Demo reservation",
      createdById: actorId,
      updatedById: actorId
    }
  });
}

async function seedHrDemoData(actorId?: string) {
  if (!actorId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: actorId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true
    }
  });

  if (!user) {
    return;
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const workDate = new Date(now.getFullYear(), now.getMonth(), Math.min(5, periodEnd.getDate()));
  const startedAt = new Date(workDate);
  startedAt.setHours(9, 0, 0, 0);
  const endedAt = new Date(workDate);
  endedAt.setHours(18, 0, 0, 0);

  const employee = await prisma.employeeProfile.upsert({
    where: { employeeNumber: "EMP-0001" },
    update: {
      userId: user.id,
      firstName: user.firstName ?? user.name.split(" ")[0] ?? "System",
      lastName: (user.lastName ?? user.name.split(" ").slice(1).join(" ")) || "Admin",
      email: user.email,
      position: "CRM administrator",
      department: "Management",
      employmentType: EmploymentType.FULL_TIME,
      baseSalary: decimal(120000),
      hourlyRate: decimal(850),
      shiftRate: decimal(5000),
      commissionRate: decimal(2),
      isActive: true,
      deletedAt: null
    },
    create: {
      userId: user.id,
      employeeNumber: "EMP-0001",
      firstName: user.firstName ?? user.name.split(" ")[0] ?? "System",
      lastName: (user.lastName ?? user.name.split(" ").slice(1).join(" ")) || "Admin",
      email: user.email,
      position: "CRM administrator",
      department: "Management",
      employmentType: EmploymentType.FULL_TIME,
      hireDate: periodStart,
      baseSalary: decimal(120000),
      hourlyRate: decimal(850),
      shiftRate: decimal(5000),
      commissionRate: decimal(2)
    }
  });
  const schedule = await upsertFirst(
    () => prisma.workSchedule.findFirst({ where: { employeeId: employee.id, name: "Standard 5/2", deletedAt: null } }),
    (id) =>
      prisma.workSchedule.update({
        where: { id },
        data: {
          type: WorkScheduleType.FIVE_TWO,
          workdayHours: decimal(8),
          startsAt: startedAt,
          endsAt: endedAt,
          timezone: process.env.PAYROLL_TIMEZONE ?? "Europe/Berlin",
          isActive: true
        }
      }),
    () =>
      prisma.workSchedule.create({
        data: {
          employeeId: employee.id,
          name: "Standard 5/2",
          type: WorkScheduleType.FIVE_TWO,
          workdayHours: decimal(8),
          startsAt: startedAt,
          endsAt: endedAt,
          timezone: process.env.PAYROLL_TIMEZONE ?? "Europe/Berlin"
        }
      })
  );

  await upsertFirst(
    () => prisma.workShift.findFirst({ where: { employeeId: employee.id, date: workDate, deletedAt: null } }),
    (id) =>
      prisma.workShift.update({
        where: { id },
        data: {
          scheduleId: schedule.id,
          plannedStart: startedAt,
          plannedEnd: endedAt,
          actualStart: startedAt,
          actualEnd: endedAt,
          status: WorkShiftStatus.WORKED
        }
      }),
    () =>
      prisma.workShift.create({
        data: {
          employeeId: employee.id,
          scheduleId: schedule.id,
          date: workDate,
          plannedStart: startedAt,
          plannedEnd: endedAt,
          actualStart: startedAt,
          actualEnd: endedAt,
          status: WorkShiftStatus.WORKED,
          comment: "Demo worked shift"
        }
      })
  );

  await upsertFirst(
    () => prisma.timeEntry.findFirst({ where: { employeeId: employee.id, date: workDate, deletedAt: null } }),
    (id) =>
      prisma.timeEntry.update({
        where: { id },
        data: {
          startedAt,
          endedAt,
          breakMinutes: 60,
          totalMinutes: 480,
          source: TimeEntrySource.MANUAL,
          approvedById: actorId,
          approvedAt: now,
          status: TimeEntryStatus.APPROVED,
          comment: "Demo approved time"
        }
      }),
    () =>
      prisma.timeEntry.create({
        data: {
          employeeId: employee.id,
          date: workDate,
          startedAt,
          endedAt,
          breakMinutes: 60,
          totalMinutes: 480,
          source: TimeEntrySource.MANUAL,
          approvedById: actorId,
          approvedAt: now,
          status: TimeEntryStatus.APPROVED,
          comment: "Demo approved time"
        }
      })
  );

  const periodName = `Demo payroll ${periodStart.toISOString().slice(0, 7)}`;
  const period = await upsertFirst(
    () => prisma.payrollPeriod.findFirst({ where: { name: periodName, deletedAt: null } }),
    (id) =>
      prisma.payrollPeriod.update({
        where: { id },
        data: {
          dateFrom: periodStart,
          dateTo: periodEnd,
          status: PayrollPeriodStatus.CALCULATED
        }
      }),
    () =>
      prisma.payrollPeriod.create({
        data: {
          name: periodName,
          dateFrom: periodStart,
          dateTo: periodEnd,
          status: PayrollPeriodStatus.CALCULATED
        }
      })
  );

  await upsertFirst(
    () => prisma.payrollAdjustment.findFirst({ where: { employeeId: employee.id, periodId: period.id, reason: "Demo performance bonus", deletedAt: null } }),
    (id) =>
      prisma.payrollAdjustment.update({
        where: { id },
        data: {
          type: PayrollAdjustmentType.BONUS,
          amount: decimal(10000),
          createdById: actorId
        }
      }),
    () =>
      prisma.payrollAdjustment.create({
        data: {
          employeeId: employee.id,
          periodId: period.id,
          type: PayrollAdjustmentType.BONUS,
          amount: decimal(10000),
          reason: "Demo performance bonus",
          createdById: actorId
        }
      })
  );

  await upsertFirst(
    () => prisma.commissionRule.findFirst({ where: { employeeId: employee.id, name: "Demo manager commission", deletedAt: null } }),
    (id) =>
      prisma.commissionRule.update({
        where: { id },
        data: {
          source: CommissionSource.PAID_ORDERS,
          percent: decimal(2),
          isActive: true
        }
      }),
    () =>
      prisma.commissionRule.create({
        data: {
          employeeId: employee.id,
          name: "Demo manager commission",
          source: CommissionSource.PAID_ORDERS,
          percent: decimal(2),
          isActive: true
        }
      })
  );

  const run = await upsertFirst(
    () => prisma.payrollRun.findFirst({ where: { periodId: period.id, deletedAt: null } }),
    (id) =>
      prisma.payrollRun.update({
        where: { id },
        data: {
          calculatedById: actorId,
          calculatedAt: now,
          status: PayrollRunStatus.CALCULATED,
          totalGross: decimal(141800),
          totalBonuses: decimal(10000),
          totalPenalties: decimal(0),
          totalCommissions: decimal(0),
          totalNet: decimal(141800)
        }
      }),
    () =>
      prisma.payrollRun.create({
        data: {
          periodId: period.id,
          calculatedById: actorId,
          calculatedAt: now,
          status: PayrollRunStatus.CALCULATED,
          totalGross: decimal(141800),
          totalBonuses: decimal(10000),
          totalPenalties: decimal(0),
          totalCommissions: decimal(0),
          totalNet: decimal(141800)
        }
      })
  );

  await prisma.payrollLine.upsert({
    where: {
      payrollRunId_employeeId: {
        payrollRunId: run.id,
        employeeId: employee.id
      }
    },
    update: {
      baseSalaryAmount: decimal(120000),
      hourlyAmount: decimal(6800),
      shiftAmount: decimal(5000),
      bonusAmount: decimal(10000),
      grossAmount: decimal(141800),
      netAmount: decimal(141800),
      workedHours: decimal(8),
      workedDays: decimal(1),
      comment: "Demo payroll line",
      deletedAt: null
    },
    create: {
      payrollRunId: run.id,
      employeeId: employee.id,
      baseSalaryAmount: decimal(120000),
      hourlyAmount: decimal(6800),
      shiftAmount: decimal(5000),
      bonusAmount: decimal(10000),
      grossAmount: decimal(141800),
      netAmount: decimal(141800),
      workedHours: decimal(8),
      workedDays: decimal(1),
      comment: "Demo payroll line"
    }
  });
}

async function upsertFirst<T extends { id: string }>(
  find: () => Promise<T | null>,
  update: (id: string) => Promise<T>,
  create: () => Promise<T>
) {
  const existing = await find();

  return existing ? update(existing.id) : create();
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function main() {
  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles();

  await prisma.permission.updateMany({
    where: {
      key: { notIn: permissionKeys },
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  });

  await assignPermissions(roleIds, permissionIds);
  await seedProductCategories();
  const actorId = await seedSuperAdmin(roleIds);
  await seedDemoData(actorId);
  await seedHrDemoData(actorId);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
