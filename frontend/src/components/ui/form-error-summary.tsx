export default function FormErrorSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <div role="alert" aria-live="assertive" className="rounded-input border border-danger bg-surface p-3 text-danger"><ul className="list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>;
}
