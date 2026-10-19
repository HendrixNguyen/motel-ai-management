import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { beforeEach } from "vitest";
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

const queueMocks = vi.hoisted(() => ({ enqueue: vi.fn(), enqueuePhoto: vi.fn(), list: vi.fn(), sync: vi.fn(), save: vi.fn(), upload: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: queueMocks.push }) }));
vi.mock("@/lib/capture/queue", () => ({ CaptureQueue: class { enqueue = queueMocks.enqueue; enqueuePhoto = queueMocks.enqueuePhoto; list = queueMocks.list; }, CaptureQueueUnavailableError: class CaptureQueueUnavailableError extends Error {} }));
vi.mock("@/lib/capture/sync", () => ({ syncCaptureQueue: queueMocks.sync }));
vi.mock("@/lib/api/capture.client", () => ({ saveCaptureReadings: queueMocks.save, uploadMeterPhoto: queueMocks.upload, isReadingConflict: (error: unknown) => (error as { code?: string })?.code === "READING_CONFLICT" }));
const captureDom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, { window: { configurable: true, value: captureDom.window }, document: { configurable: true, value: captureDom.window.document }, navigator: { configurable: true, value: captureDom.window.navigator }, HTMLElement: { configurable: true, value: captureDom.window.HTMLElement }, Node: { configurable: true, value: captureDom.window.Node }, Event: { configurable: true, value: captureDom.window.Event }, MouseEvent: { configurable: true, value: captureDom.window.MouseEvent }, FormData: { configurable: true, value: captureDom.window.FormData }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true } });
beforeAll(() => { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true }); });
const electric = reading("electric", "101.00");
const water = reading("water", "101.00");
function domSetup(props: Partial<React.ComponentProps<typeof CaptureReadingClient>> = {}) { const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); return { host, render: async (p = props) => act(async () => root.render(createElement(CaptureReadingClient, { managerId: "manager-1", motelId: period.motelId, period, reading: electric, roomName: "P.101", roomReadings: [electric], ...p }))), cleanup: async () => { await act(async () => root.unmount()); host.remove(); } }; }
beforeEach(() => { queueMocks.enqueue.mockResolvedValue(undefined); queueMocks.enqueuePhoto.mockResolvedValue(undefined); queueMocks.list.mockResolvedValue([]); queueMocks.sync.mockResolvedValue({ readings: { sent: 0, failed: 0, conflicts: 0, locked: 0 }, photos: { sent: 0, failed: 0, locked: 0 } }); queueMocks.save.mockResolvedValue(undefined); queueMocks.upload.mockResolvedValue(undefined); queueMocks.push.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

 describe("capture responsive layout", () => {
  it("keeps capture controls bounded to viewport at mobile widths", () => {
    const item = reading("electric", "101.00");
    const html = renderToStaticMarkup(createElement(CaptureReadingClient, { managerId: "manager-1", motelId: period.motelId, period, reading: item, roomName: "P.101", roomReadings: [item], nextUrl: undefined }));

    expect(html).toContain('style="width:100%;max-width:min(100%, 32rem)"');
    expect(html).toContain("min-w-0 flex-wrap");
  });
});

describe("capture preview rates", () => {
  it("locks finalized periods and prevents saving", async () => {
    const view = domSetup({ period: { ...period, status: "sent" } });
    await view.render({ period: { ...period, status: "sent" } });
    expect(view.host.textContent).toContain("Kỳ đã chốt · Chỉ xem");
    expect((view.host.querySelector("input") as HTMLInputElement).disabled).toBe(true);
    expect((view.host.querySelector('button[class*="flex-1"]') as HTMLButtonElement).disabled).toBe(true);
    await view.cleanup();
  });

  it("queues a valid reading and photo, then follows next URL on success", async () => {
    queueMocks.enqueue.mockResolvedValue(undefined); queueMocks.enqueuePhoto.mockResolvedValue(undefined);
    queueMocks.sync.mockResolvedValue({ readings: { sent: 1, failed: 0, conflicts: 0, locked: 0 }, photos: { sent: 1, failed: 0, locked: 0 } });
    const view = domSetup({ nextUrl: "/capture/period/next" });
    await view.render({ nextUrl: "/capture/period/next" });
    const input = view.host.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    await act(async () => { input.value = "102.00"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
    const file = new File([new Uint8Array([255, 216, 255])], "meter.jpg", { type: "image/jpeg" });
    const uploadInput = view.host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(uploadInput, "files", { configurable: true, value: [file] });
    await act(async () => uploadInput.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => (view.host.querySelector('button[class*="flex-1"]') as HTMLButtonElement).click());
    expect(queueMocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ readings: [expect.objectContaining({ currentReading: "101.00", type: "electric" })] }));
    expect(queueMocks.enqueuePhoto).toHaveBeenCalledWith(expect.objectContaining({ file, readingId: electric.id }));
    expect(queueMocks.push).toHaveBeenCalledWith("/capture/period/next");
    await view.cleanup();
  });

  it("reports offline and conflict queue failures", async () => {
    queueMocks.enqueue.mockRejectedValueOnce(new Error("offline"));
    const view = domSetup();
    await view.render();
    const input = view.host.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    await act(async () => { input.value = "102.00"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => (view.host.querySelector('button[class*="flex-1"]') as HTMLButtonElement).click());
    expect(view.host.textContent).toContain("Không thể lưu chỉ số");
    queueMocks.enqueue.mockRejectedValueOnce(Object.assign(new Error("conflict"), { code: "READING_CONFLICT" }));
    await act(async () => (view.host.querySelector('button[class*="flex-1"]') as HTMLButtonElement).click());
    expect(view.host.textContent).toContain("Xung đột: chỉ số máy chủ đã đổi. Nhập lại.");
    await view.cleanup();
  });

  it("uses electricity and water rates from the billing period DTO", () => {
    const electric = reading("electric", "101.00");

    const electricHtml = renderToStaticMarkup(createElement(CaptureReadingClient, { managerId: "manager-1", motelId: period.motelId, period, reading: electric, roomName: "P.101", roomReadings: [electric], nextUrl: undefined }));
    const waterHtml = renderToStaticMarkup(createElement(CaptureReadingClient, { managerId: "manager-1", motelId: period.motelId, period, reading: water, roomName: "P.101", roomReadings: [water], nextUrl: undefined }));

    expect(electricHtml).toContain("Ước tính 4321 ₫");
    expect(waterHtml).toContain("Ước tính 27890 ₫");
    expect(electricHtml).not.toContain("3500");
    expect(waterHtml).not.toContain("15000");
  });
});
