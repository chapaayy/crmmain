import {
  BagBottomType,
  BagTopType,
  BagType,
  CustomerStatus,
  CustomerType,
  DiscountType,
  LeadStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RoleCode,
  StockMovementType
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
  ["audit_logs.read", "Read audit logs", "audit_logs", "read"]
] as const;

const roleDescriptions: Record<RoleCode, string> = {
  SUPER_ADMIN: "Full system access with all permissions.",
  ADMIN: "Administrative access for CRM configuration and user management.",
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
const readPermissions = permissions
  .map(([key]) => key)
  .filter((key) => key.endsWith(".read") && !adminPermissionKeys.includes(key));
const permissionKeys = permissions.map(([key]) => key);

const rolePermissionKeys: Record<RoleCode, string[]> = {
  SUPER_ADMIN: permissions.map(([key]) => key),
  ADMIN: permissions.map(([key]) => key),
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
