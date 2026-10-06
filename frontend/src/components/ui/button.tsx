import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  pending?: boolean;
  pendingLabel?: string;
};

const variants = {
  primary: "border-primary bg-primary text-surface hover:bg-primary-strong",
  secondary: "border-border-strong bg-surface text-text-body hover:bg-canvas",
  ghost: "border-transparent text-primary hover:bg-canvas",
  danger: "border-danger bg-danger text-surface hover:bg-danger/90",
};
const sizes = { sm: "px-3 py-2", md: "px-4 py-2", lg: "px-6 py-3" };

export default function Button({ variant = "primary", size = "md", pending = false, pendingLabel = "Đang xử lý…", disabled, type = "button", className = "", children, ...props }: ButtonProps) {
  return (
    <button {...props} type={type} disabled={disabled || pending} aria-busy={pending || undefined}
      className={`inline-flex min-h-11 min-w-11 max-w-full cursor-pointer items-center justify-center gap-2 rounded-input border text-base font-semibold leading-normal break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
