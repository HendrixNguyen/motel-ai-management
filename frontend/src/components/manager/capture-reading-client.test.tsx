import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CaptureReadingClient from "@/components/manager/capture-reading-client";
import type { BillingPeriodDetailResponse, MeterReadingResponse } from "@/lib/api/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const period: BillingPeriodDetailResponse = {
  id: "period-1",
  motelId: "motel-1",
  month: 10,
  year: 2026,
  status: "draft",
  electricityPrice: "4321",
  waterPrice: "27890",
  createdAt: "2026-10-01T00:00:00.000Z",
  rooms: [],
};

function reading(type: MeterReadingResponse["type"], currentReading: string): MeterReadingResponse {
  return { id: `${type}-1`, roomId: "room-1", type, previousReading: "100.00", currentReading, readingDate: null, updatedAt: "2026-10-01T00:00:00.000Z" };
}

describe("capture preview rates", () => {
  it("uses electricity and water rates from the billing period DTO", () => {
    const electric = reading("electric", "101.00");
    const water = reading("water", "101.00");
    const electricHtml = renderToStaticMarkup(createElement(CaptureReadingClient, { motelId: period.motelId, period, reading: electric, roomName: "P.101", roomReadings: [electric], nextUrl: undefined }));
    const waterHtml = renderToStaticMarkup(createElement(CaptureReadingClient, { motelId: period.motelId, period, reading: water, roomName: "P.101", roomReadings: [water], nextUrl: undefined }));

    expect(electricHtml).toContain("Ước tính 4321 ₫");
    expect(waterHtml).toContain("Ước tính 27890 ₫");
    expect(electricHtml).not.toContain("3500");
    expect(waterHtml).not.toContain("15000");
  });
});
