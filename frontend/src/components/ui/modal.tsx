"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog as RadixDialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onOpenAutoFocus?: (event: { preventDefault: () => void; currentTarget: HTMLElement }) => void;
  onCloseAutoFocus?: (event: { preventDefault: () => void }) => void;
  onPointerDownOutside?: (event: { preventDefault: () => void }) => void;
  onInteractOutside?: (event: { preventDefault: () => void }) => void;
  "data-destructive"?: boolean;
  "data-autofocus"?: "preserve";
  "data-block-outside-dismiss"?: "true";
  "data-testid"?: string;
};

/** showModal supplies the top layer, inert background, focus trap and Escape behavior. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  onOpenAutoFocus,
  onOpenChange,
  onCloseAutoFocus,
  onPointerDownOutside,
  onInteractOutside,
  drawer = false,
  "data-autofocus": autofocus,
  "data-block-outside-dismiss": blockOutsideDismiss,
  "data-destructive": destructive,
  "data-testid": testId,
  ...rest
}: ModalProps & { drawer?: boolean }) {
  const id = useId();
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        triggerElementRef.current = active;
      }
    }
  }, [open]);

  return (
    <RadixDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (onOpenChange) {
          onOpenChange(nextOpen);
        } else if (!nextOpen) {
          onClose();
        }
      }}
      modal={true}
    >
      <DialogPortal>
        <DialogContent
          data-dialog
          data-testid={testId}
          data-autofocus={autofocus}
          data-block-outside-dismiss={blockOutsideDismiss}
          data-destructive={destructive || undefined}
          {...rest}
          data-motion="dialog"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-description` : undefined}
          onOpenAutoFocus={(event) =>
            onOpenAutoFocus?.({
              preventDefault: () => event.preventDefault(),
              currentTarget: event.currentTarget as HTMLElement,
            })
          }
          onCloseAutoFocus={(event) => {
            if (onCloseAutoFocus) {
              onCloseAutoFocus({ preventDefault: () => event.preventDefault() });
            } else if (!event.defaultPrevented) {
              event.preventDefault();
              triggerElementRef.current?.focus();
            }
          }}
          onPointerDownOutside={(event) =>
            onPointerDownOutside?.({ preventDefault: () => event.preventDefault() })
          }
          onInteractOutside={(event) =>
            onInteractOutside?.({ preventDefault: () => event.preventDefault() })
          }
          data-drawer={drawer ? "true" : "false"}
          showCloseButton={false}
          className={
            drawer
              ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh w-[min(100vw,32rem)] max-w-none translate-x-0 translate-y-0 rounded-none"
              : "max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] max-w-none rounded-card"
          }
        >
          <div
            data-dialog-header
            className="flex items-start justify-between gap-3 border-b border-border p-4"
          >
            <DialogHeader className="min-w-0">
              <DialogTitle id={`${id}-title`} className="break-words">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription id={`${id}-description`}>{description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogClose asChild>
              <Button variant="ghost" className="shrink-0" aria-label="Đóng">
                Đóng
              </Button>
            </DialogClose>
          </div>
          <div data-dialog-content className="min-w-0 overflow-y-auto p-4">
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </RadixDialog>
  );
}

export default function Modal(props: ModalProps) {
  return <Dialog {...props} />;
}
