import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind utilities while retaining independent classes", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4 text-base")).toBe("px-4 text-base");
  });
});
