export default function TruncatedText({ value, className = "" }: { value: string; className?: string }) {
  return <span title={value} aria-label={value} className={`block min-w-0 ${className}`}><span aria-hidden="true" className="block truncate">{value}</span><span className="sr-only">{value}</span></span>;
}
