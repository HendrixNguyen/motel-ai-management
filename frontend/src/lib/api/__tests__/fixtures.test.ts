import { describe, expect, it } from "vitest";

import { parseVndDigits } from "@/lib/format/vnd";
import { renterStatusLabel, roomStatusLabel } from "@/lib/format/status";
import type { RenterStatus, RoomStatus } from "@/lib/api/types";
import {
  ACTIVE_CONTRACT,
  CREATE_MOTEL,
  INVOICE_OVERDUE,
  MANAGER_AUTH,
  MANAGER_ME,
  MOTEL,
  MOTEL_WITHOUT_EXTRAS,
  RENTER,
  RENTER_DETAIL,
  RENTER_DETAIL_WITHOUT_HISTORY,
  RENTER_WITHOUT_ROOM,
  RENTERS,
  ROOMS,
  ROOM,
  ROOM_WITHOUT_FLOOR,
} from "./fixtures";

/**
 * The brief's requirement, in test form: *each response fixture assigned to its `*Response` type,
 * so a shape change breaks the build rather than the screen.*
 *
 * `fixtures.ts` is where the assignments live. What this file adds is the runtime half, because a
 * type annotation is only as strong as the code around it: a fixture changed with an `as` cast, or
 * a fixture edited so that a money field became a number, both still typecheck. Each assertion below
 * is falsifiable — the value it names is the only thing that can satisfy it.
 */

/** Every `VndString` the response types declare, as `[fixture, path]` pairs. */
const MONEY_PATHS: Array<[string, Array<string | number>, string]> = [
  ["MotelResponse.electricityPrice", ["MOTEL", "electricityPrice"], MOTEL.electricityPrice],
  ["MotelResponse.waterPrice", ["MOTEL", "waterPrice"], MOTEL.waterPrice],
  ["MotelFeeInput.amount", ["MOTEL", "otherFees", 0, "amount"], MOTEL.otherFees[0]!.amount],
  ["RoomResponse.basePrice", ["ROOM", "basePrice"], ROOM.basePrice],
  [
    "ActiveContractSummary.monthlyRent",
    ["RENTER_DETAIL", "activeContract", "monthlyRent"],
    RENTER_DETAIL.activeContract!.monthlyRent,
  ],
  [
    "RecentInvoice.totalAmount",
    ["RENTER_DETAIL", "invoices", 0, "totalAmount"],
    RENTER_DETAIL.invoices[0]!.totalAmount,
  ],
];

describe("money fields on the wire", () => {
  it.each(MONEY_PATHS)("%s is a bare digit string", (_name, _path, value) => {
    expect(typeof value).toBe("string");
    expect(parseVndDigits(value)).toBe(value);
  });

  it("covers every VndString the response types declare, so the guard below is not a spot check", () => {
    // A new money field on the backend is a new VndString in `lib/api/types.ts`. It only reaches
    // this list if someone adds a fixture for it, and this assertion is what makes "you forgot"
    // a failing test rather than a silent gap in `MONEY_KEYS`.
    expect(MONEY_PATHS.map(([name]) => name).sort()).toEqual([
      "ActiveContractSummary.monthlyRent",
      "MotelFeeInput.amount",
      "MotelResponse.electricityPrice",
      "MotelResponse.waterPrice",
      "RecentInvoice.totalAmount",
      "RoomResponse.basePrice",
    ]);
  });

  it("sends a create body's amounts as the digit strings the backend's parseAmount accepts", () => {
    expect(parseVndDigits(CREATE_MOTEL.electricityPrice)).toBe("3500");
    expect(parseVndDigits(CREATE_MOTEL.waterPrice)).toBe("15000");
    expect(parseVndDigits(CREATE_MOTEL.otherFees![0]!.amount)).toBe("50000");
  });
});

describe("response fixtures", () => {
  it("renders a full room list as bare digits and ISO instants, never floats", () => {
    for (const room of ROOMS) {
      expect(room.basePrice).toMatch(/^\d+$/);
      expect(new Date(room.createdAt).toISOString()).toBe(room.createdAt);
    }
  });

  it("renders `createdAt` as an ISO-8601 UTC instant, which is what toISOString() produced", () => {
    expect(new Date(MOTEL.createdAt).toISOString()).toBe("2026-09-01T02:00:00.000Z");
    expect(new Date(ROOM.createdAt).toISOString()).toBe(ROOM.createdAt);
    expect(new Date(RENTER.createdAt).toISOString()).toBe(RENTER.createdAt);
    expect(new Date(INVOICE_OVERDUE.createdAt).toISOString()).toBe(INVOICE_OVERDUE.createdAt);
  });

  it("keeps contract dates as calendar days, so no timezone can shift them", () => {
    expect(ACTIVE_CONTRACT.startDate).toBe("2026-09-01");
    expect(ACTIVE_CONTRACT.endDate).toBe("2027-08-31");
    expect(new Date(`${ACTIVE_CONTRACT.startDate}T00:00:00.000Z`).toISOString()).toBe(
      `${ACTIVE_CONTRACT.startDate}T00:00:00.000Z`,
    );
  });

  it("answers an empty motel with empty arrays and nulls rather than omitting the keys", () => {
    expect(MOTEL_WITHOUT_EXTRAS.otherFees).toEqual([]);
    expect(MOTEL_WITHOUT_EXTRAS.bankAccount).toBeNull();
    expect(MOTEL_WITHOUT_EXTRAS.address).toBeNull();
    // A key the backend always sends must be present even when its value is null: a screen that
    // reads `motel.bankAccount.accountName` needs `null` to be there to fail loudly, not undefined.
    expect(Object.keys(MOTEL_WITHOUT_EXTRAS).sort()).toEqual(
      [
        "address",
        "bankAccount",
        "createdAt",
        "electricityPrice",
        "id",
        "managerId",
        "name",
        "otherFees",
        "waterPrice",
      ].sort(),
    );
  });

  it("keeps a nullable room floor null instead of coercing it to 0", () => {
    expect(ROOM_WITHOUT_FLOOR.floor).toBeNull();
    expect(ROOM.floor).toBe(1);
  });

  it("answers a renter with neither contract nor invoice with null and [], not empty objects", () => {
    expect(RENTER_DETAIL_WITHOUT_HISTORY.activeContract).toBeNull();
    expect(RENTER_DETAIL_WITHOUT_HISTORY.invoices).toEqual([]);
  });

  it("carries a list response as a bare JSON array, which is what the services return", () => {
    expect(Array.isArray(RENTERS)).toBe(true);
    expect(RENTERS.map((renter) => renter.name)).toEqual(["Trần Thị B", "Lê Văn C"]);
    expect(Array.isArray(ROOMS)).toBe(true);
  });

  it("keeps the two auth shapes distinct: login knows the name, /me does not", () => {
    expect(MANAGER_AUTH).toHaveProperty("name");
    expect(Object.keys(MANAGER_AUTH).sort()).toEqual(["email", "id", "name"]);
    // The one assertion that stops a later task unifying the two types for being "similar": a
    // unified type would let a screen read `me.name`, and the backend never sends it.
    expect(Object.keys(MANAGER_ME).sort()).toEqual(["email", "id"]);
    expect("name" in MANAGER_ME).toBe(false);
  });

  it("keeps the renter's phone in the normalised 84XXXXXXXXX form the backend stores", () => {
    expect(RENTER.phone).toMatch(/^84\d{9}$/);
  });
});

describe("the status unions are shared, not redeclared", () => {
  it("feeds a response's status straight into the label map of lib/format/status", () => {
    // `lib/api/types.ts` re-exports `RoomStatus` and `RenterStatus` rather than declaring its own
    // (D7, ruling R1). Two *identical* unions are indistinguishable to TypeScript, so this assertion
    // is what catches the failure that matters: a second union that has drifted, which adds or drops
    // a value. `status.ts` labels through `Record<RoomStatus, string>`, so a value the map does not
    // know stops compiling here — and an unenumerated value is a status that would reach a screen
    // and throw there.
    expect(roomStatusLabel(ROOM.status)).toBe("Đang ở");
    expect(roomStatusLabel(ROOM_WITHOUT_FLOOR.status)).toBe("Trống");
    expect(renterStatusLabel(RENTER.status)).toBe("Đang thuê");
    expect(renterStatusLabel(RENTER_WITHOUT_ROOM.status)).toBe("Đã kết thức hợp đồng");
  });

  it("labels every value the backend's enums can hold, so no status is unlabelled", () => {
    const rooms: RoomStatus[] = ["available", "occupied", "maintenance"];
    const renters: RenterStatus[] = ["active", "inactive"];

    expect(rooms.map(roomStatusLabel)).toEqual(["Trống", "Đang ở", "Bảo trì"]);
    expect(renters.map(renterStatusLabel)).toEqual(["Đang thuê", "Đã kết thức hợp đồng"]);
  });
});
