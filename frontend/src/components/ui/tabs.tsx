"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export default function Tabs({ tabs }: { tabs: readonly Tab[] }) {
  const instanceId = useId().replace(/:/g, "");
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const tabId = (id: string) => `${instanceId}-${id}-tab`;
  const panelId = (id: string) => `${instanceId}-${id}-panel`;
  const move = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    if (next) { setActive(next.id); document.getElementById(tabId(next.id))?.focus(); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(index + 1); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); move(0); }
    else if (event.key === "End") { event.preventDefault(); move(tabs.length - 1); }
  };
  return <div><div role="tablist" aria-label="Các mục nội dung" className="flex min-w-0 overflow-x-auto border-b border-border">{tabs.map((tab, index) => <button id={tabId(tab.id)} key={tab.id} type="button" role="tab" aria-selected={tab.id === current?.id} aria-controls={panelId(tab.id)} tabIndex={tab.id === current?.id ? 0 : -1} className="min-h-11 shrink-0 border-b-2 border-transparent px-4 text-sm font-semibold text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-selected:border-primary aria-selected:text-primary" onClick={() => setActive(tab.id)} onKeyDown={(event) => onKeyDown(event, index)}>{tab.label}</button>)}</div>{current && <div id={panelId(current.id)} role="tabpanel" aria-labelledby={tabId(current.id)} tabIndex={0} className="min-w-0 py-4">{current.content}</div>}</div>;
}
