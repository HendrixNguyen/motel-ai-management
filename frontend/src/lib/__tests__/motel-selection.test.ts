import { describe, expect, it, vi } from "vitest";
import { resolveMotelId } from "@/lib/motel-selection";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

const motels = [{ id: "owned-first" }, { id: "owned-second" }];

describe("resolveMotelId", () => {
  it("defaults to the first owned motel when the parameter is absent", () => {
    expect(resolveMotelId(motels, {})).toBe("owned-first");
  });
  it("uses the selected owned motel rather than the first one", () => {
    expect(resolveMotelId(motels, { motel: "owned-second" })).toBe("owned-second");
  });
  it("allows a manager with no motels to reach the empty state", () => {
    expect(resolveMotelId([], {})).toBeUndefined();
  });
  it.each([{ motel: "foreign" }, { motel: "" }, { motel: ["owned-first", "foreign"] }])("denies an invalid explicit selection $motel", ({ motel }) => {
    expect(() => resolveMotelId(motels, { motel })).toThrow("NEXT_NOT_FOUND");
  });
  it("denies an explicit selection even when the manager owns no motels", () => {
    expect(() => resolveMotelId([], { motel: "foreign" })).toThrow("NEXT_NOT_FOUND");
  });
});
