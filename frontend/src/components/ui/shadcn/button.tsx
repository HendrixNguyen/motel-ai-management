import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-input text-base font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-on-primary hover:bg-primary-strong",
        destructive: "border border-danger bg-danger text-white hover:bg-danger/90",
        outline: "border border-border-strong bg-surface text-text-body hover:bg-canvas",
        secondary: "border border-border-strong bg-surface text-text-body hover:bg-canvas",
        ghost: "border border-transparent text-primary hover:bg-canvas",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2.5",
        xs: "min-h-11 min-w-11 gap-1 px-2 text-xs",
        sm: "min-h-11 min-w-11 gap-1.5 px-3 py-2 text-sm",
        lg: "min-h-11 min-w-11 px-6 py-3",
        icon: "h-11 w-11 p-0",
        "icon-xs": "h-11 w-11 p-0 text-xs",
        "icon-sm": "h-11 w-11 p-0",
        "icon-lg": "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={asChild ? undefined : "button"}
      data-slot="button"
      data-shadcn-button="true"
      data-variant={variant}
      data-size={size}
      aria-busy={props["aria-busy"]}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
