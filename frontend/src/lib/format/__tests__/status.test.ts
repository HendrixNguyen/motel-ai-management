import { describe, expect, it } from "vitest";

import {
  oaFollowerLabel,
  roomStatusLabel,
  renterStatusLabel,
  type RoomStatus,
  type RenterStatus,
} from "@/lib/format/status";

// The keys are the PostgreSQL enum values (Drizzle `pgEnum` in
// `backend/src/modules/room/room.schema.ts` and `renter/renter.schema.ts`); the values are the
// Vietnamese words a manager reads on a badge. The tables are spelled out rather than derived from
// the maps, so a label change or a dropped value fails a test instead of a screen.
const ROOM_STATUSES: ReadonlyArray<readonly [RoomStatus, string]> = [
  ["available", "Trống"],
  ["occupied", "Đang ở"],
  ["maintenance", "Bảo trì"],
];

const RENTER_STATUSES: ReadonlyArray<readonly [RenterStatus, string]> = [
  ["active", "Đang thuê"],
  ["inactive", "Đã kết thức hợp đồng"],
];

describe("roomStatusLabel", () => {
  it.each(ROOM_STATUSES)("labels %s as %s", (status, label) => {
    expect(roomStatusLabel(status)).toBe(label);
  });

  it("gives the three statuses three different words", () => {
    // M3's filter bar is built from these labels; two options reading the same is an unusable bar.
    const labels = ROOM_STATUSES.map(([status]) => roomStatusLabel(status));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("renterStatusLabel", () => {
  it.each(RENTER_STATUSES)("labels %s as %s", (status, label) => {
    expect(renterStatusLabel(status)).toBe(label);
  });

  it("gives the two statuses two different words", () => {
    const labels = RENTER_STATUSES.map(([status]) => renterStatusLabel(status));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("does not borrow a room's word for a renter's tenancy", () => {
    // `renters.roomId` is nullable and `status` defaults to `active`, so an active renter can sit
    // beside an empty Phòng cell — "Đang ở" there states something false, and it collapses an
    // occupied room and an active tenancy into one word when the two facts are independent.
    expect(renterStatusLabel("active")).not.toBe(roomStatusLabel("occupied"));
    expect(renterStatusLabel("active")).not.toBe(roomStatusLabel("available"));
  });
});

describe("oaFollowerLabel", () => {
  it("names a follower and a non-follower", () => {
    expect(oaFollowerLabel(true)).toBe("Đã follow");
    expect(oaFollowerLabel(false)).toBe("Chưa follow");
  });

  it("is not derived from the other two maps", () => {
    // A renter who has never followed the OA is not `inactive`; the two vocabularies are separate
    // and this keeps a well-meaning refactor from merging them.
    expect(oaFollowerLabel(false)).not.toBe(renterStatusLabel("inactive"));
    expect(oaFollowerLabel(true)).not.toBe(renterStatusLabel("active"));
  });
});
