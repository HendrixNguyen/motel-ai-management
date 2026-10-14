export type BadgeTone = "success" | "warning" | "danger" | "neutral";
export const badgeTones: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success", warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger", neutral: "bg-canvas text-text-muted",
};

export default function Badge({ tone = "neutral", label }: { tone?: BadgeTone; label: string }) {
  return <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold leading-normal break-words ${badgeTones[tone]}`}>{label}</span>;
}
