import type { ReactNode } from "react";

export default function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><h1 className="font-heading text-2xl font-bold tracking-tight text-text">{title}</h1>{description && <p className="mt-2 max-w-2xl text-base leading-7 text-text-muted">{description}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}</header>;
}
