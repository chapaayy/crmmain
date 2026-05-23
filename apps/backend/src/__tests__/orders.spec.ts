import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { DiscountType, OrderStatus, PaymentStatus } from "@prisma/client";
import { __ordersTestUtils, OrdersService } from "../orders/orders.service";

test("order totals helpers calculate line totals, discounts, and payment status", () => {
  assert.deepEqual(__ordersTestUtils.calculateLine(10, 125.5, 50), {
    discount: 50,
    total: 1205
  });
  assert.equal(__ordersTestUtils.calculateOrderDiscount(1000, DiscountType.PERCENT, 7.5), 75);
  assert.equal(__ordersTestUtils.calculateOrderDiscount(1000, DiscountType.FIXED, 1200), 1000);
  assert.equal(__ordersTestUtils.resolvePaymentStatus(0, 1000), PaymentStatus.UNPAID);
  assert.equal(__ordersTestUtils.resolvePaymentStatus(400, 1000), PaymentStatus.PARTIALLY_PAID);
  assert.equal(__ordersTestUtils.resolvePaymentStatus(1000, 1000), PaymentStatus.PAID);
  assert.equal(__ordersTestUtils.resolvePaymentStatus(1100, 1000), PaymentStatus.OVERPAID);
});

test("order line helper rejects invalid quantity", () => {
  assert.throws(() => __ordersTestUtils.calculateLine(0, 100, 0), BadRequestException);
});

test("orders service rejects invalid status transition before mutating order", async () => {
  let updateCalled = false;
  const service = new OrdersService(
    {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          order: {
            findFirst: async () => ({
              id: "order-1",
              number: "ORD-1",
              status: OrderStatus.DRAFT
            }),
            update: async () => {
              updateCalled = true;
            }
          }
        })
    } as never,
    {
      createForUsers: async () => []
    } as never
  );

  await assert.rejects(
    () => service.updateStatus("order-1", { status: OrderStatus.SHIPPED }, "actor-1"),
    /Cannot move order from DRAFT to SHIPPED/
  );
  assert.equal(updateCalled, false);
});
