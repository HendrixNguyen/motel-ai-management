import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      data-shadcn-label="true"
      className={cn("text-sm font-semibold leading-none text-text-body", className)}
      {...props}
    />
  );
}
