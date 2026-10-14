export default function Skeleton({ label = "Đang tải…", className = "h-20" }: { label?: string; className?: string }) {
  return <div role="status" className="min-w-0"><span className="sr-only">{label}</span><div aria-hidden="true" className={`rounded-card bg-border motion-safe:animate-pulse ${className}`} /></div>;
}
