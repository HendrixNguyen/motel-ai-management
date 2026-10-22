import { describe, expect, it } from "vitest";
import { createCaptureQueueScope } from "@/lib/capture/queue-scope";

describe("capture queue identity scope", () => {
  it("is derived from authenticated manager identity, motel and period", () => {
    expect(createCaptureQueueScope("manager-1", "motel-1", "period-1")).toEqual({
      managerId: "manager-1",
      motelId: "motel-1",
      periodId: "period-1",
    });
  });
  it("refuses an empty or malformed server identity", () => {
    expect(() => createCaptureQueueScope("", "motel-1", "period-1")).toThrow(
      "CAPTURE_IDENTITY_REQUIRED",
    );
    expect(() => createCaptureQueueScope("manager-1", "", "period-1")).toThrow(
      "CAPTURE_IDENTITY_REQUIRED",
    );
  });
});
