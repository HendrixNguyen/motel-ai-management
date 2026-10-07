import { describe, expect, test } from "bun:test";
import { listRoomsForBilling } from "@/modules/room/room.service";
import { listBillableContractsForMotel } from "@/modules/contract/contract.service";

describe("billing source projections", () => {
  test("exports documented projection functions", () => {
    expect(typeof listRoomsForBilling).toBe("function");
    expect(typeof listBillableContractsForMotel).toBe("function");
  });
});
