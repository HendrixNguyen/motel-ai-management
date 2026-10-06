import Button from "./button";

export default function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-6 text-center">
      <h2 className="font-heading text-lg font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-base leading-normal text-text-body">{description}</p>
      <div className="mt-4"><Button onClick={onAction}>{actionLabel}</Button></div>
    </div>
  );
}
