type FieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** Minimal Task 5 primitive; the render prop keeps accessibility wiring on the actual control. */
export default function Field({ id, label, error, children }: {
  id: string;
  label: string;
  error?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">{label}</label>
      {children({ id, "aria-describedby": error ? `${id}-error` : undefined, "aria-invalid": error ? true : undefined })}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
