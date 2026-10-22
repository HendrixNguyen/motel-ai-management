import { act, createElement } from "react";
import { cleanup } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { JSDOM } from "jsdom";
import type { RoomResponse } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  submitRoom: vi.fn(),
  submitRoomStatus: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@/lib/room-form", async () => {
  const actual = await vi.importActual<typeof import("@/lib/room-form")>("@/lib/room-form");
  return {
    ...actual,
    createRoomFormSession: (motelId: string, room?: RoomResponse) => ({
      initialDraft: actual.createRoomDraft(room),
      submit: (draft: Parameters<typeof actual.submitRoom>[1]) =>
        mocks.submitRoom(motelId, draft, room),
    }),
    submitRoomStatus: mocks.submitRoomStatus,
  };
});
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.notify }));
import RoomEditor from "@/components/manager/room-editor";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  Event: { configurable: true, value: dom.window.Event },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new dom.window.Event("close"));
};
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return {
    host,
    root,
    render: async (value: React.ReactNode) => act(async () => root.render(value)),
    cleanup: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
const room: RoomResponse = {
  id: "room-1",
  motelId: "motel-1",
  name: "101",
  floor: 1,
  basePrice: "3500000",
  status: "available",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("RoomEditor behavior branches", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  test("creates from empty state and shows success feedback", async () => {
    mocks.submitRoom.mockResolvedValue({ ok: true });
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", empty: true }));
      await act(async () => (view.host.querySelector("button") as HTMLButtonElement).click());
      const input = view.host.querySelector('input[name="name"]') as HTMLInputElement;
      await act(async () => {
        input.value = "102";
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      expect(mocks.submitRoom).toHaveBeenCalledOnce();
      expect(mocks.notify).toHaveBeenCalledWith({ message: "Đã thêm phòng trọ" });
      expect(mocks.refresh).toHaveBeenCalled();
    } finally {
      await view.cleanup();
    }
  });

  test("validation errors are listed and clicking one focuses its field", async () => {
    mocks.submitRoom.mockResolvedValue({
      ok: false,
      fields: { name: "Nhập tên phòng", basePrice: "Nhập giá hợp lệ" },
    });
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", empty: true }));
      await act(async () => (view.host.querySelector("button") as HTMLButtonElement).click());
      await act(async () =>
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      const nameError = [...view.host.querySelectorAll("a")].find(
        (link) => link.textContent === "Nhập tên phòng",
      )!;
      await act(async () =>
        nameError.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
      );
      expect(document.activeElement?.getAttribute("name")).toBe("name");
      expect(view.host.querySelector('[role="alert"]')).not.toBeNull();
    } finally {
      await view.cleanup();
    }
  });

  test("404 exposes reload action without redirect", async () => {
    mocks.submitRoomStatus.mockResolvedValue({ ok: false, status: 404, error: "Room not found" });
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", room }));
      await act(async () => view.host.querySelectorAll("button")[1]?.click());
      await act(async () =>
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      expect(view.host.textContent).toContain("Tải lại danh sách");
      expect(mocks.replace).not.toHaveBeenCalled();
    } finally {
      await view.cleanup();
    }
  });

  test("room trigger regains focus when dialog closes", async () => {
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", room }));
      const trigger = view.host.querySelector("button") as HTMLButtonElement;
      await act(async () => {
        trigger.focus();
        trigger.click();
      });
      await act(async () =>
        (view.host.querySelector('button[aria-label="Đóng"]') as HTMLButtonElement)?.click(),
      );
      expect(document.activeElement).toBe(trigger);
    } finally {
      await view.cleanup();
    }
  });

  test("room create submission rejection restores enabled state with safe error", async () => {
    mocks.submitRoom.mockRejectedValue(new Error("private database host"));
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1" }));
      await act(async () => (view.host.querySelector("button") as HTMLButtonElement).click());
      await act(async () =>
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      expect(view.host.querySelector("[role=alert]")?.textContent).toContain(
        "Đã xảy ra lỗi hệ thống",
      );
      expect((view.host.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(false);
    } finally {
      await view.cleanup();
    }
  });

  test("room status rejection restores enabled state with safe error", async () => {
    mocks.submitRoomStatus.mockRejectedValue(new Error("private database host"));
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", room }));
      const trigger = [...view.host.querySelectorAll("button")].find(
        (button) => button.textContent === "Đổi trạng thái",
      )!;
      await act(async () => trigger.click());
      await act(async () =>
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      expect(view.host.querySelector("[role=alert]")?.textContent).toContain(
        "Đã xảy ra lỗi hệ thống",
      );
      expect((view.host.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(false);
    } finally {
      await view.cleanup();
    }
  });

  test("unauthorized status mutation closes modal and redirects", async () => {
    mocks.submitRoomStatus.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const view = setup();
    try {
      await view.render(createElement(RoomEditor, { motelId: "motel-1", room }));
      const buttons = [...view.host.querySelectorAll("button")];
      await act(async () =>
        buttons.find((button) => button.textContent === "Đổi trạng thái")?.click(),
      );
      await act(async () => {
        (view.host.querySelector("form") as HTMLFormElement).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      expect(mocks.submitRoomStatus).toHaveBeenCalledWith("motel-1", "room-1", "available");
      expect(mocks.replace).toHaveBeenCalledWith("/login");
      expect(mocks.refresh).toHaveBeenCalled();
    } finally {
      await view.cleanup();
    }
  });
});
