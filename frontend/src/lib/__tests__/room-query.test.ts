import { describe, expect, it } from "vitest";
import { parseRoomFilters, roomFiltersHref } from "@/lib/room-query";

describe("shareable room filters", () => {
  it("decodes zero, signed floor and trimmed Vietnamese search without losing motel scope", () => {
    expect(parseRoomFilters({ floor: "0", status: "available", search: " P.đỏ " })).toEqual({ floor: 0, status: "available", search: "P.đỏ" });
    expect(parseRoomFilters({ floor: "-2" })).toEqual({ floor: -2 });
    expect(roomFiltersHref("motel A", { floor: 0, status: "maintenance", search: "P.đỏ & 1" })).toBe("/rooms?motel=motel+A&floor=0&status=maintenance&search=P.%C4%91%E1%BB%8F+%26+1");
  });
  it("drops empty, malformed, repeated and out-of-range filters before they reach PostgreSQL", () => {
    expect(parseRoomFilters({ floor: "", status: "", search: " " })).toEqual({});
    expect(parseRoomFilters({ floor: "1.5", status: "vacant", search: ["a", "b"] })).toEqual({});
    expect(parseRoomFilters({ floor: ["0", "1"], status: ["occupied", "maintenance"] })).toEqual({});
    expect(parseRoomFilters({ floor: "2147483648" })).toEqual({});
    expect(parseRoomFilters({ floor: "-2147483649" })).toEqual({});
    expect(parseRoomFilters({ floor: "1e2" })).toEqual({});
  });
  it("accepts both int4 boundaries and clears filters without dropping the selected motel", () => {
    expect(parseRoomFilters({ floor: "2147483647" })).toEqual({ floor: 2147483647 });
    expect(parseRoomFilters({ floor: "-2147483648" })).toEqual({ floor: -2147483648 });
    expect(roomFiltersHref("selected", {})).toBe("/rooms?motel=selected");
  });
});
