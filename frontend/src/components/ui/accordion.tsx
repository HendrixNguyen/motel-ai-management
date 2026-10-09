"use client";

import { useState, type ReactNode } from "react";

export default function Accordion({ items }: { items: readonly { id: string; title: string; content: ReactNode }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return <div>{items.map((item) => { const expanded = open === item.id; return <div key={item.id} className="border-b border-border"><button type="button" aria-expanded={expanded} aria-controls={`${item.id}-content`} className="flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => setOpen(expanded ? null : item.id)}>{item.title}<span aria-hidden="true">{expanded ? "−" : "+"}</span></button><div id={`${item.id}-content`} hidden={!expanded} className="pb-4 text-text-body">{item.content}</div></div>; })}</div>;
}
