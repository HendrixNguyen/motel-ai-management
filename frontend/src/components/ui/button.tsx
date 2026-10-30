import {
  Button as ShadcnButton,
  type ButtonProps as ShadcnButtonProps,
} from "@/components/ui/shadcn/button";

export type ButtonProps = Omit<ShadcnButtonProps, "variant" | "size"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  pending?: boolean;
  pendingLabel?: string;
};

export default function Button({
  variant = "primary",
  size = "md",
  pending = false,
  pendingLabel = "Đang xử lý…",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const mappedVariant =
    variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant;
  const mappedSize = size === "md" ? "default" : size;

  return (
    <ShadcnButton
      variant={mappedVariant}
      size={mappedSize}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? pendingLabel : children}
    </ShadcnButton>
  );
}
