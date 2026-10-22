import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import RenterCccdUploads from "@/components/manager/renter-cccd-uploads";

const mocks = vi.hoisted(() => ({ get: vi.fn(), upload: vi.fn() }));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) => createElement("img", props),
}));
vi.mock("@/lib/api/renters.client", () => ({
  getRenterCccdUrl: mocks.get,
  uploadRenterCccd: mocks.upload,
}));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("manager-only CCCD upload behavior", () => {
  test("uploads each side and marks only uploaded side", async () => {
    mocks.upload.mockResolvedValue({ uploaded: true });
    const view = render(
      <RenterCccdUploads
        motelId="m"
        renterId="r"
        renterName="Nguyễn A"
        frontUploaded={false}
        backUploaded={false}
      />,
    );
    const files = view.getAllByLabelText(/CCCD mặt/);
    fireEvent.change(files[0]!, {
      target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() =>
      expect(mocks.upload).toHaveBeenCalledWith("m", "r", "front", expect.any(File)),
    );
    expect(view.getByText("Mặt trước · Đã tải lên")).toBeInTheDocument();
    expect(view.getByText("Mặt sau · Chưa có ảnh")).toBeInTheDocument();
  });

  test("opens and closes signed image preview", async () => {
    mocks.get.mockResolvedValue({
      url: "https://signed.example/doc",
      contentType: "image/jpeg",
      size: 4,
    });
    const view = render(
      <RenterCccdUploads
        motelId="m"
        renterId="r"
        renterName="Nguyễn A"
        frontUploaded
        backUploaded={false}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Xem ảnh" }));
    expect(await view.findByAltText("CCCD mặt trước của Nguyễn A")).toHaveAttribute(
      "src",
      "https://signed.example/doc",
    );
    fireEvent.click(view.getByRole("button", { name: "Đóng ảnh" }));
    expect(view.queryByAltText("CCCD mặt trước của Nguyễn A")).toBeNull();
  });

  test("shows upload and preview API failures without leaking object keys", async () => {
    mocks.upload.mockRejectedValue(new Error("Upload failed"));
    const view = render(
      <RenterCccdUploads
        motelId="m"
        renterId="r"
        renterName="Nguyễn A"
        frontUploaded={false}
        backUploaded={true}
      />,
    );
    fireEvent.change(view.getAllByLabelText(/CCCD mặt/)[0]!, {
      target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
    });
    expect(await view.findByRole("alert")).toHaveTextContent("Upload failed");
    mocks.get.mockRejectedValue(new Error("Expired signed URL"));
    fireEvent.click(view.getByRole("button", { name: "Xem ảnh" }));
    expect(await view.findByRole("alert")).toHaveTextContent("Expired signed URL");
    expect(view.queryByText(/objectKey|secret/i)).toBeNull();
  });
});
