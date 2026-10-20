import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CapturePage from "@/app/(manager)/capture/page";
import CapturePeriodPage from "@/app/(manager)/capture/[periodId]/page";
import type { BillingPeriodDetailResponse, BillingPeriodResponse } from "@/lib/api/types";

const periods: BillingPeriodResponse[] = [
  { id: "draft-1", motelId: "motel-1", month: 10, year: 2026, status: "draft", createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "sent-1", motelId: "motel-1", month: 9, year: 2026, status: "sent", createdAt: "2026-09-01T00:00:00.000Z" },
];

const period: BillingPeriodDetailResponse = {
  id: "draft-1", motelId: "motel-1", month: 10, year: 2026, status: "draft",
  electricityPrice: "3500", waterPrice: "15000", createdAt: "2026-10-01T00:00:00.000Z",
  rooms: [
    { id: "room-1", name: "P.101", readings: [
      { id: "e-1", roomId: "room-1", type: "electric", previousReading: "100", currentReading: null, readingDate: null, updatedAt: "v1" },
      { id: "w-1", roomId: "room-1", type: "water", previousReading: "20", currentReading: "25", readingDate: null, updatedAt: "v1" },
    ] },
    { id: "room-2", name: "P.102", readings: [
      { id: "e-2", roomId: "room-2", type: "electric", previousReading: "50", currentReading: "60", readingDate: null, updatedAt: "v1" },
      { id: "w-2", roomId: "room-2", type: "water", previousReading: "10", currentReading: "11", readingDate: null, updatedAt: "v1" },
    ] },
  ],
};

const apiMocks = vi.hoisted(() => ({ listMotels: vi.fn(), listBillingPeriods: vi.fn(), getBillingPeriod: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, usePathname: () => "/capture" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/ui/page-header", () => ({ default: ({ title, description }: { title: string; description?: string }) => createElement("header", null, createElement("h1", null, title), description) }));
vi.mock("@/lib/api/motels", () => ({ listMotels: apiMocks.listMotels }));
vi.mock("@/lib/api/billing", () => ({ listBillingPeriods: apiMocks.listBillingPeriods, getBillingPeriod: apiMocks.getBillingPeriod }));

apiMocks.listMotels.mockResolvedValue([{ id: "motel-1", name: "Nhà trọ", address: null, electricityPrice: "3500", waterPrice: "15000", otherFees: [], bankAccount: null, createdAt: "2026-01-01" }]);
apiMocks.listBillingPeriods.mockResolvedValue(periods);
apiMocks.getBillingPeriod.mockResolvedValue(period);

function markup(element: Promise<React.ReactElement>) {
  return element.then(renderToStaticMarkup);
}

describe("capture entry Quiet Ledger surfaces", () => {
  it("lists draft periods with month and room progress, never sent periods", async () => {
    const html = await markup(CapturePage({ searchParams: Promise.resolve({ motel: "motel-1" }) }));
    expect(html).toContain("10/2026");
    expect(html).toContain("Tiến độ phòng chưa có trong dữ liệu danh sách kỳ.");
    expect(html).toContain("Kỳ nháp");
    expect(html).not.toContain("09/2026");
    expect(html).not.toContain("Đang nhập");
  });

  it("shows independent period selection action", async () => {
    const html = await markup(CapturePage({ searchParams: Promise.resolve({ motel: "motel-1" }) }));
    expect(html).toContain('aria-label="Mở kỳ 10/2026"');
  });

  it("summarizes room state by both meters and keeps one-handed actions full-width", async () => {
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    expect(html).toContain("1/2");
    expect(html).toContain("Điện</span>: Chưa nhập");
    expect(html).toContain("Nước</span>: 25");
    expect(html).toContain("Đang nhập");
    expect(html).toContain("min-h-[72px]");
    expect(html).toContain("Trạng thái đồng bộ sẽ hiển thị trong trang nhập.");
    expect(html).not.toContain("Đã đồng bộ");
    expect(html).not.toContain("Ngoại tuyến · hàng đợi lưu trên thiết bị");
  });

  it("does not count a room complete when one required meter is absent", async () => {
    apiMocks.getBillingPeriod.mockResolvedValueOnce({ ...period, rooms: [{ id: "room-3", name: "P.103", readings: [
      { id: "e-3", roomId: "room-3", type: "electric", previousReading: "10", currentReading: "12", readingDate: null, updatedAt: "v1" },
    ] }] });
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    expect(html).toContain("0/1 phòng đã nhập đủ điện và nước");
    expect(html).toContain('aria-disabled="true"');
  });

  it("does not count duplicate electricity rows as a complete room", async () => {
    const completeReadings = period.rooms[0]!.readings.map((reading) => ({ ...reading, currentReading: "12" }));
    apiMocks.getBillingPeriod.mockResolvedValueOnce({ ...period, rooms: [{ id: "room-1", name: "P.101", readings: [completeReadings[0]!, { ...completeReadings[1]!, type: "electric", id: "e-duplicate" }] }] });
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    expect(html).toContain("0/1 phòng đã nhập đủ điện và nước");
    expect(html).toContain('aria-disabled="true"');
  });

  it("does not count duplicate meter rows as complete", async () => {
    const completeReadings = period.rooms[0]!.readings.map((reading) => ({ ...reading, currentReading: "12" }));
    apiMocks.getBillingPeriod.mockResolvedValueOnce({ ...period, rooms: [{ id: "room-1", name: "P.101", readings: [completeReadings[0]!, { ...completeReadings[1]!, type: "electric", id: "e-duplicate" }] }] });
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    expect(html).toContain("0/1 phòng đã nhập đủ điện và nước");
    expect(html).toContain('aria-disabled="true"');
  });

  it("keeps completion disabled and names missing meters for rooms with no readings", async () => {
    apiMocks.getBillingPeriod.mockResolvedValueOnce({ ...period, rooms: [...period.rooms, { id: "room-3", name: "P.103", readings: [] }] });
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    const ctaPosition = html.indexOf("Hoàn tất &amp; tạo hóa đơn");
    const disabledCta = html.slice(ctaPosition - 500, ctaPosition);
    expect(html).toContain("Phòng P.103: chưa có công tơ để nhập.");
    expect(html).toContain("1/3 phòng đã nhập đủ điện và nước");
    expect(disabledCta).toContain('aria-disabled="true"');
    expect(disabledCta).toContain('tabindex="-1"');
  });

  it("shows an explicit locked state for a sent period", async () => {
    apiMocks.getBillingPeriod.mockResolvedValueOnce({ ...period, status: "sent" });
    const html = await markup(CapturePeriodPage({
      params: Promise.resolve({ periodId: "draft-1" }),
      searchParams: Promise.resolve({ motel: "motel-1" }),
    }));
    expect(html).toContain("Kỳ đã chốt");
    expect(html).toContain("Hàng đợi được khóa");
  });
});
