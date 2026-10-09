"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  const stored = window.localStorage.getItem("motel-theme");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export default function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    queueMicrotask(() => setTheme(getStoredTheme()));
  }, []);
  function change(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("motel-theme", next);
    document.documentElement.dataset.theme = next === "system" ? "" : next;
  }
  return <label className="block text-sm text-text"><span className="mb-1 block font-semibold">Giao diện</span><select aria-label="Giao diện" value={theme} onChange={(event) => change(event.target.value as Theme)} className="min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 text-text"><option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label>;
}
