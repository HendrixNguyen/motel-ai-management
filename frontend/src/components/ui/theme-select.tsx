"use client";

import { useEffect, useState } from "react";

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

export function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem("motel-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export default function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const cleanup = syncSystemTheme(stored, document.documentElement, media);
    return cleanup;
  }, []);
  function change(next: Theme) {
    setTheme(next);
    try { window.localStorage.setItem("motel-theme", next); } catch {}
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(next, document.documentElement, media.matches);
  }
  return <label className="block text-sm text-text"><span className="mb-1 block font-semibold">Giao diện</span><select aria-label="Giao diện" value={theme} onChange={(event) => change(event.target.value as Theme)} className="min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 text-text"><option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label>;
}
