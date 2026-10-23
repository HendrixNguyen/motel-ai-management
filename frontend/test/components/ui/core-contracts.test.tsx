import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { JSDOM } from "jsdom";
import { beforeAll } from "vitest";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import Badge from "@/components/ui/badge";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import Drawer from "@/components/ui/drawer";
import { ToastProvider } from "@/components/ui/toast";
import ThemeSelect from "@/components/ui/theme-select";
import ThemeInit from "@/components/ui/theme-init";
import Dropdown from "@/components/ui/dropdown";
import type { CoreTone, CoreTheme, SpacingToken } from "@/components/ui/contracts";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  KeyboardEvent: { configurable: true, value: dom.window.KeyboardEvent },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});
beforeAll(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
});

describe("Core UI v2 compatibility contracts", () => {
  test("exports shared semantic contract types", () => {
    const tone: CoreTone = "success";
    const theme: CoreTheme = "system";
    const spacing: SpacingToken = "md";
    expect([tone, theme, spacing]).toEqual(["success", "system", "md"]);
  });

  test("Button keeps default action semantics and visible keyboard focus", () => {
    const html = markup(<Button>Save</Button>);
    expect(html).toContain("Save");
    expect(html).toContain('type="button"');
    expect(html).toContain("min-h-11");
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-offset-2");
  });

  test("Field keeps label and error association", () => {
    const html = markup(
      <Field id="name" label="Name" error="Required">
        {(props) => <input {...props} />}
      </Field>,
    );
    expect(html).toContain('for="name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-error"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Required");
  });

  test("Dialog session restores trigger once on close and unmount", async () => {
    const { openDialogSession } = await import("@/components/ui/dialog-session");
    const dialog = document.createElement("dialog");
    const trigger = document.createElement("button");
    const focus = vi.spyOn(trigger, "focus");
    let closed = 0;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
      closed += 1;
      dialog.dispatchEvent(new dom.window.Event("close"));
    };
    const dispose = openDialogSession(dialog, trigger);
    expect(dialog.open).toBe(true);
    dispose();
    dialog.dispatchEvent(new dom.window.Event("close"));
    expect(closed).toBe(1);
    expect(focus).toHaveBeenCalledOnce();
  });

  test("Modal and Drawer preserve headings and mobile width", () => {
    const modal = markup(
      <Modal open={false} onClose={() => {}} title="Edit">
        Body
      </Modal>,
    );
    const drawer = markup(
      <Drawer open={false} onClose={() => {}} title="Menu">
        Body
      </Drawer>,
    );
    expect(modal).toContain("Edit");
    expect(modal).toContain("relative z-50");
    expect(modal).toContain("w-[min(32rem,calc(100vw-2rem))]");
    expect(drawer).toContain("w-[min(100vw,32rem)]");
  });

  test("Badge preserves tone and label", () => {
    const html = markup(<Badge label="Active" tone="success" />);
    expect(html).toContain("Active");
    expect(html).toContain("bg-success-bg");
  });

  test("StatCard preserves labelled definition list", () => {
    const html = markup(<StatCard label="Rooms" value={12} description="Available" />);
    expect(html).toContain("Rooms");
    expect(html).toContain("12");
    expect(html).toContain("Available");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
  });

  test("EmptyState preserves action and copy", () => {
    const html = markup(
      <EmptyState title="Empty" description="Nothing" actionLabel="Add" onAction={() => {}} />,
    );
    expect(html).toContain("Empty");
    expect(html).toContain("Nothing");
    expect(html).toContain("Add");
  });

  test("DataTable preserves caption, labels, and row data", () => {
    const html = markup(
      <DataTable
        rows={[{ id: "1", name: "Room 1" }]}
        columns={[{ key: "name", label: "Name", render: (row) => row.name }]}
        getRowId={(row) => row.id}
        caption="Rooms"
      />,
    );
    expect(html).toContain("Rooms");
    expect(html).toContain("Name");
    expect(html).toContain("Room 1");
    expect(html).toContain('scope="col"');
  });

  test("ToastProvider preserves live region and children", () => {
    const html = markup(<ToastProvider>Toast children</ToastProvider>);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Toast children");
  });

  test("mobile billing label stays scoped to compact navigation subtree", async () => {
    const { default: Sidebar } = await import("@/components/manager/sidebar");
    const html = markup(<Sidebar />);
    expect(html).toContain('aria-label="Điều hướng chính"');
    expect(html).toContain('aria-label="Điều hướng gọn trên điện thoại"');
    expect(html).toContain('aria-label="Tính tiền &amp; Hóa đơn"');
    expect(html).toContain(">Hóa đơn</span>");
  });

  test("Dropdown keeps long values readable, bounds the option list, and exposes selection state", () => {
    const html = markup(
      <Dropdown
        id="room"
        value="room-1"
        onChange={() => {}}
        options={[
          { value: "room-1", label: "Phòng có tên rất dài, không được cắt mất nội dung" },
          { value: "room-2", label: "Phòng 102" },
        ]}
      />,
    );
    expect(html).toContain("Phòng có tên rất dài, không được cắt mất nội dung");
    expect(html).toContain("min-w-0 flex-1 text-left [overflow-wrap:anywhere]");
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-value="room-1"');
    expect(html).not.toContain("max-h-60");
    expect(html).not.toContain('role="listbox"');
  });

  test("Dropdown changes value and closes after selecting an option", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const values: string[] = [];
    try {
      await act(async () => {
        root.render(
          createElement(Dropdown, {
            id: "room",
            value: "room-1",
            onChange: (value: string) => values.push(value),
            options: [
              { value: "room-1", label: "Phòng 101" },
              { value: "room-2", label: "Phòng 102" },
            ],
          }),
        );
      });
      await act(async () => {
        (host.querySelector('[role="combobox"]') as HTMLButtonElement).click();
      });
      expect(host.querySelector('[role="listbox"]')).not.toBeNull();
      await act(async () => {
        (host.querySelector('[role="option"][data-option-index="1"]') as HTMLLIElement).click();
      });
      expect(values).toEqual(["room-2"]);
      expect(host.querySelector('[role="listbox"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  test("Dropdown closes when clicked outside and when disabled", async () => {
    const host = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(host, outside);
    const root = createRoot(host);
    const props = {
      id: "room",
      value: "room-1",
      onChange: () => {},
      options: [{ value: "room-1", label: "101" }],
    };
    try {
      await act(async () => {
        root.render(createElement(Dropdown, props));
      });
      await act(async () => {
        (host.querySelector('[role="combobox"]') as HTMLButtonElement).click();
      });
      await act(async () => {
        outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(host.querySelector('[role="listbox"]')).toBeNull();
      await act(async () => {
        root.render(createElement(Dropdown, { ...props, disabled: true }));
      });
      expect((host.querySelector('[role="combobox"]') as HTMLButtonElement).disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      outside.remove();
    }
  });

  test("Dropdown keyboard Escape and arrows close and cycle selection", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const values: string[] = [];
    try {
      await act(async () => {
        root.render(
          createElement(Dropdown, {
            id: "room",
            value: "room-1",
            onChange: (value: string) => values.push(value),
            options: [
              { value: "room-1", label: "101" },
              { value: "room-2", label: "102" },
            ],
          }),
        );
      });
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      });
      expect(values).toEqual(["room-2"]);
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(host.querySelector('[role="listbox"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  test("Dropdown handles unresolved selection and closes after clearing placeholder", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const values: string[] = [];
    try {
      await act(async () =>
        root.render(
          createElement(Dropdown, {
            id: "missing",
            value: "missing",
            onChange: (value: string) => values.push(value),
            options: [],
          }),
        ),
      );
      expect(host.querySelector("[role=combobox]")?.textContent).toContain("Chọn");
      await act(async () => (host.querySelector("[role=combobox]") as HTMLButtonElement).click());
      expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
      await act(async () => (host.querySelector('[role="option"]') as HTMLLIElement).click());
      expect(values).toEqual([""]);
      expect(host.querySelector('[role="listbox"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  test("Dropdown arrow keys wrap and no options leave selection unchanged", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const values: string[] = [];
    try {
      await act(async () =>
        root.render(
          createElement(Dropdown, {
            id: "room",
            value: "room-1",
            onChange: (value: string) => values.push(value),
            options: [
              { value: "room-1", label: "101" },
              { value: "room-2", label: "102" },
            ],
          }),
        ),
      );
      await act(async () => {
        (host.querySelector('[role="combobox"]') as HTMLButtonElement).click();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      });
      expect(values).toEqual(["room-2"]);
      await act(async () =>
        root.render(
          createElement(Dropdown, {
            id: "empty",
            value: "",
            onChange: (value: string) => values.push(value),
            options: [],
          }),
        ),
      );
      await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })),
      );
      expect(values).toEqual(["room-2"]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  test("ThemeInit emits safe inline theme bootstrap", () => {
    const markup = renderToStaticMarkup(<ThemeInit />);
    expect(markup).toContain("motel-theme");
    expect(markup).toContain("prefers-color-scheme: dark");
    expect(markup).toContain("<script>");
    expect(markup).toContain("</script>");
  });

  test("theme helpers choose light/dark fallbacks, subscribe only to system media and tolerate storage failures", async () => {
    const { applyTheme, changeTheme, getStoredTheme, resolveTheme, syncSystemTheme } =
      await import("@/components/ui/theme-select");
    const root = { dataset: {} as { theme?: string } };
    expect(resolveTheme("unknown", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    applyTheme("system", root, false);
    expect(root.dataset.theme).toBe("light");
    const add = vi.fn();
    const remove = vi.fn();
    const media = { matches: true, addEventListener: add, removeEventListener: remove };
    const cleanupLight = syncSystemTheme("light", root, media);
    expect(add).not.toHaveBeenCalled();
    cleanupLight();
    const cleanupSystem = syncSystemTheme("system", root, media);
    expect(add).toHaveBeenCalledOnce();
    cleanupSystem();
    expect(remove).toHaveBeenCalledOnce();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "invalid",
        setItem: () => {
          throw new Error("blocked");
        },
      },
      matchMedia: () => media,
    });
    expect(getStoredTheme()).toBe("light");
    changeTheme("dark", root, media);
    expect(root.dataset.theme).toBe("dark");
    vi.unstubAllGlobals();
  });

  test("ThemeSelect renders system theme on server", () => {
    const html = markup(<ThemeSelect />);
    expect(html).toContain('for="theme-select-button"');
    expect(html).toContain("Sáng");
  });
});
