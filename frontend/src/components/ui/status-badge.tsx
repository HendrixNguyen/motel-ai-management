import Badge, { type BadgeTone } from "./badge";

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return <Badge label={label} tone={tone} />;
}
