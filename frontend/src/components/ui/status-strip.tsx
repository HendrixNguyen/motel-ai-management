import type { ReactNode } from "react";
import type { BadgeTone } from "./badge";

const tones: Record<BadgeTone, string> = { success: "border-success bg-success-bg text-success", warning: "border-warning bg-warning-bg text-warning", danger: "border-danger bg-danger-bg text-danger", neutral: "border-border bg-canvas text-text-body" };

export default function StatusStrip({ message, tone = "neutral", action }: { message: string; tone?: BadgeTone; action?: ReactNode }) {
  return <div role={tone === "danger" ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-3 rounded-card border p-4 ${tones[tone]}`}><span>{message}</span>{action}</div>;
}
