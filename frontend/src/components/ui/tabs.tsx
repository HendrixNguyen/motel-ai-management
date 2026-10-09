"use client";

import { useState, type ReactNode } from "react";

export default function Tabs({ tabs }: { tabs: readonly { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return <div><div role="tablist" aria-label="Các mục nội dung" className="flex min-w-0 overflow-x-auto border-b border-border">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === current?.id} aria-controls={`${tab.id}-panel`} tabIndex={tab.id === current?.id ? 0 : -1} className="min-h-11 shrink-0 border-b-2 border-transparent px-4 text-sm font-semibold text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-selected:border-primary aria-selected:text-primary" onClick={() => setActive(tab.id)}>{tab.label}</button>)}</div>{current && <div id={`${current.id}-panel`} role="tabpanel" tabIndex={0} className="min-w-0 py-4">{current.content}</div>}</div>;
}
