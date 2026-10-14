import { cloneElement, isValidElement, type ReactNode } from "react";

export type FieldControlProps = { id: string; className: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

export const controlClassName = "min-h-11 min-w-11 w-full max-w-full rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

export default function Field({ id, label, hint, describedBy, error, children }: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  describedBy?: string;
  children: ((props: FieldControlProps) => ReactNode) | ReactNode;
}) {
  const descriptions = [describedBy, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">{label}</label>
      {typeof children === "function" ? children({ id, className: controlClassName, "aria-describedby": descriptions, "aria-invalid": error ? true : undefined }) : isValidElement(children) ? cloneElement(children as React.ReactElement<Record<string, unknown>>, { id, className: [controlClassName, (children.props as { className?: string }).className].filter(Boolean).join(" "), "aria-describedby": [(children.props as { "aria-describedby"?: string })["aria-describedby"], descriptions].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : (children.props as { "aria-invalid"?: boolean })["aria-invalid"] }) : children}
      {hint && <p id={`${id}-hint`} className="text-sm text-text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
