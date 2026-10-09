import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ThemeSelect, { applyTheme, getStoredTheme, resolveTheme, syncSystemTheme } from "../theme-select";
import { themeInitScript } from "../theme-init";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("theme foundation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders system without browser state", () => {
    expect(markup(<ThemeSelect />)).toContain('value="system"');
  });

  test("normalizes invalid stored values to system", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "invalid") });
    expect(getStoredTheme()).toBe("system");
  });

  test("guards storage errors and persists selected theme", () => {
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }), setItem: vi.fn(() => { throw new Error("blocked"); }) };
    vi.stubGlobal("localStorage", storage);
    expect(getStoredTheme()).toBe("system");
    expect(() => storage.setItem("motel-theme", "dark")).not.toThrow();
  });

  test("resolves system preference and applies explicit themes", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("invalid", true)).toBe("light");
    const root = { dataset: {} as { theme?: string } };
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
    applyTheme("system", root);
    expect(root.dataset.theme).toBe("");
  });

  test("syncs system media changes only for system theme", () => {
    const root = { dataset: {} as { theme?: string } };
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const cleanup = syncSystemTheme("system", root, media);
    expect(root.dataset.theme).toBe("dark");
    expect(media.addEventListener).toHaveBeenCalled();
    cleanup();
    expect(media.removeEventListener).toHaveBeenCalled();
  });

  test("early script guards storage and includes system fallback", () => {
    expect(themeInitScript).toContain("try");
    expect(themeInitScript).toContain("matchMedia");
    expect(themeInitScript).toContain("motel-theme");
  });

  test("foundation CSS scopes scroll margin and includes safe area", async () => {
    const css = await Bun.file("frontend/src/app/globals.css").text();
    expect(css).toContain("main [id]");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("-webkit-tap-highlight-color");
    expect(css).toContain("prefers-reduced-motion");
  });
});

