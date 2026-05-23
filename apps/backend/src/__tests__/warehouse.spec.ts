import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { __warehouseTestUtils, WarehouseService } from "../warehouse/warehouse.service";

test("warehouse helpers calculate available stock and reject over-reservation", () => {
  assert.equal(__warehouseTestUtils.calculateAvailableStock(100, 35.5554), 64.445);
  assert.doesNotThrow(() => __warehouseTestUtils.assertCanReserveStock(100, 35, 65));
  assert.throws(() => __warehouseTestUtils.assertCanReserveStock(100, 35, 66), BadRequestException);
});

test("warehouse reservation helper does not mutate stock when reserve exceeds available", async () => {
  let updateCalled = false;
  const service = new WarehouseService({} as never, { createForPermission: async () => [] } as never);
  const testService = service as unknown as {
    getOrCreateStockItem: () => Promise<unknown>;
    changeReservation: (
      tx: unknown,
      warehouseId: string,
      productVariantId: string,
      quantity: number,
      actorId: string,
      unit: string,
      mode: "reserve" | "release"
    ) => Promise<unknown>;
  };

  testService.getOrCreateStockItem = async () => ({
    id: "stock-1",
    quantity: { toString: () => "10" },
    reservedQuantity: { toString: () => "8" }
  });

  await assert.rejects(
    () =>
      testService.changeReservation(
        {
          stockItem: {
            update: async () => {
              updateCalled = true;
            }
          }
        },
        "warehouse-1",
        "variant-1",
        3,
        "actor-1",
        "pcs",
        "reserve"
      ),
    /Cannot reserve more than available stock/
  );
  assert.equal(updateCalled, false);
});
