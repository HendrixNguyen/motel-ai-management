"use client";

import * as React from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/shadcn/button";
import { XIcon } from "lucide-react";

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  });

  return <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={setOpen} {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-text/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  onPointerDownOutside?: (event: CustomEvent) => void;
  onInteractOutside?: (event: CustomEvent) => void;
  "data-autofocus"?: "preserve";
  "data-block-outside-dismiss"?: "true";
  "data-drawer"?: "true" | "false";
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-drawer={props["data-drawer"]}
        onPointerDownOutside={(event) => {
          if (typeof props.onPointerDownOutside === "function") {
            props.onPointerDownOutside(event);
          }
          if (props["data-block-outside-dismiss"] === "true") event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (typeof props.onInteractOutside === "function") {
            props.onInteractOutside(event);
          }
          if (props["data-block-outside-dismiss"] === "true") event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          props.onOpenAutoFocus?.(event);
          if (props["data-autofocus"] === "preserve" || event.defaultPrevented) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          const content = event.currentTarget;
          if (content instanceof HTMLElement) {
            const focusable = content.querySelector<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
            );
            (focusable ?? content).focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          props.onCloseAutoFocus?.(event);
        }}
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-card border border-border-strong bg-surface p-6 text-text shadow-lg duration-180 ease-out outline-none data-[drawer=false]:m-0 data-[drawer=false]:w-[min(32rem,calc(100vw-2rem))] data-[drawer=false]:max-w-none data-[drawer=false]:rounded-card data-[drawer=true]:inset-y-0 data-[drawer=true]:right-0 data-[drawer=true]:left-auto data-[drawer=true]:m-0 data-[drawer=true]:h-dvh data-[drawer=true]:w-[min(100vw,32rem)] data-[drawer=true]:max-w-none data-[drawer=true]:translate-x-0 data-[drawer=true]:translate-y-0 data-[drawer=true]:rounded-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-3 right-3 flex min-h-11 min-w-11 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none motion-reduce:transition-none"
          >
            <XIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">Đóng</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Đóng</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-text-muted", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
