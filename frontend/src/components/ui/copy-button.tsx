"use client";

import { useState } from "react";
import { Button } from "@/components/ui/shadcn/button";

export default function CopyButton({
  value,
  label = "Sao chép",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "copied" | "error">("idle");
  return (
    <div className="min-w-0 space-y-2">
      <Button
        variant="secondary"
        disabled={status === "pending"}
        aria-busy={status === "pending"}
        onClick={async () => {
          setStatus("pending");
          try {
            await navigator.clipboard.writeText(value);
            setStatus("copied");
          } catch {
            setStatus("error");
          }
        }}
      >
        {status === "pending" ? "Đang sao chép…" : label}
      </Button>
      <p
        role="status"
        className={`min-h-5 text-sm ${status === "error" ? "text-danger" : "text-success"}`}
      >
        {status === "copied"
          ? "Đã sao chép"
          : status === "error"
            ? "Không thể sao chép. Hãy chọn và sao chép nội dung thủ công."
            : ""}
      </p>
    </div>
  );
}
