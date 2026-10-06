export type FieldControlProps = { id: string; className: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

const controlClassName = "min-h-11 min-w-11 w-full max-w-full rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

/** The render prop keeps label, hint and error wiring on the actual control. */
export default function Field({ id, label, hint, describedBy, error, children }: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  describedBy?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const descriptions = [describedBy, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">{label}</label>
      {children({ id, className: controlClassName, "aria-describedby": descriptions, "aria-invalid": error ? true : undefined })}
      {hint && <p id={`${id}-hint`} className="text-sm text-text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
