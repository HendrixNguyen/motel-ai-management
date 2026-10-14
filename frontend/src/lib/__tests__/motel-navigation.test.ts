import { describe, expect, it } from "vitest";
import { motelHref } from "@/lib/motel-navigation";

describe("motel URL navigation", () => {
  it("changes only motel while keeping the current route and filters", () => {
    expect(motelHref("/rooms", "motel=first&status=available", "second")).toBe("/rooms?motel=second&status=available");
  });
  it("sets the initial selection without losing existing parameters", () => {
    expect(motelHref("/renters", "roomId=room-one", "first")).toBe("/renters?roomId=room-one&motel=first");
  });
  it("keeps an empty URL empty when there is no motel to select", () => {
    expect(motelHref("/", "", undefined)).toBe("/");
  });
});
