export default function Progress({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const bounded = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const percent = (bounded / safeMax) * 100;
  return <div className="space-y-1"><div className="flex justify-between gap-2 text-sm text-text-muted"><span>{label}</span><span>{bounded}/{safeMax}</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={bounded} className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
}
