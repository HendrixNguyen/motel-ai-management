"use client";

import { useEffect, useState } from "react";
import Dropdown from "./dropdown";

export type Theme = "light" | "dark" | "system";

export function resolveTheme(theme: string, systemDark: boolean): "light" | "dark" {
  return theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";
}

export function applyTheme(theme: Theme, root: { dataset: { theme?: string } }, systemDark = false) {
  root.dataset.theme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

export function syncSystemTheme(theme: Theme, root: { dataset: { theme?: string } }, media: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">) {
  const update = () => applyTheme(theme, root, media.matches);
  update();
  if (theme !== "system") return () => {};
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

export function changeTheme(theme: Theme, root: { dataset: { theme?: string } }, media: Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">) {
  try { window.localStorage.setItem("motel-theme", theme); } catch {}
  applyTheme(theme, root, media.matches);
}

export function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem("motel-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
  } catch {
    return "light";
  }
}

const themeOptions = [
  { value: "system", label: "Theo hệ thống" },
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

export default function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    queueMicrotask(() => setTheme(getStoredTheme()));
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    return syncSystemTheme(theme, document.documentElement, media);
  }, [theme]);
  function change(next: Theme) {
    setTheme(next);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    changeTheme(next, document.documentElement, media);
  }
  return (
    <label htmlFor="theme-select-button" className="block text-sm text-text">
      <span className="mb-1 block font-semibold">Giao diện</span>
      <Dropdown
        id="theme-select"
        options={themeOptions}
        value={theme}
        onChange={(value) => change(value as Theme)}
      />
    </label>
  );
}
