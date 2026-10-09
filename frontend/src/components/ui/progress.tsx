export default function Progress({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const bounded = Math.min(max, Math.max(0, value));
  return <div className="space-y-1"><div className="flex justify-between gap-2 text-sm text-text-muted"><span>{label}</span><span>{bounded}/{max}</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={bounded} className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${max ? (bounded / max) * 100 : 0}%` }} /></div></div>;
}
