import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:text-base",
        className,
      )}
      {...props}
    />
  );
}
