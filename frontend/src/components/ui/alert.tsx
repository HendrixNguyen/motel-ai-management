import type { ReactNode } from "react";
import type { BadgeTone } from "./badge";

const styles: Record<BadgeTone, string> = { success: "border-success bg-success-bg text-success", warning: "border-warning bg-warning-bg text-warning", danger: "border-danger bg-danger-bg text-danger", neutral: "border-border bg-canvas text-text-body" };

export default function Alert({ tone = "neutral", title, description, action }: { tone?: BadgeTone; title: string; description?: string; action?: ReactNode }) {
  const critical = tone === "danger";
  return <div role={critical ? "alert" : "status"} aria-live={critical ? "assertive" : "polite"} className={`min-w-0 rounded-card border p-4 ${styles[tone]}`}>
    <p className="font-semibold text-text">{title}</p>
    {description && <p className="mt-1 break-words">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>;
}
