import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { __warehouseTestUtils } from "../warehouse/warehouse.service";

test("warehouse helpers calculate available stock and reject over-reservation", () => {
  assert.equal(__warehouseTestUtils.calculateAvailableStock(100, 35.5554), 64.445);
  assert.doesNotThrow(() => __warehouseTestUtils.assertCanReserveStock(100, 35, 65));
  assert.throws(() => __warehouseTestUtils.assertCanReserveStock(100, 35, 66), BadRequestException);
});
