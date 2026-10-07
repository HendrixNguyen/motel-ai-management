"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Button from "./button";
import { openDialogSession } from "./dialog-session";

export type ModalProps = { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode };

/** showModal supplies the top layer, inert background, focus trap and Escape behavior. */
export function Dialog({ open, onClose, title, description, children, footer, drawer = false }: ModalProps & { drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open || dialog.open) return;
    return openDialogSession(dialog, document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const dialog = ref.current;
        if (!dialog) return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((control) => control.getClientRects().length > 0 && !control.matches(":disabled") && control.tabIndex >= 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClose={() => { if (!ref.current?.open) onClose(); }}
      className={`max-h-dvh w-full overflow-y-auto overscroll-contain border border-border bg-surface p-0 text-text-body shadow-xl backdrop:bg-text/40 ${drawer ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-w-lg" : "m-auto max-w-lg rounded-card"}`}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0"><h2 id={`${id}-title`} className="font-heading text-lg font-semibold text-text break-words">{title}</h2>
          {description && <p id={`${id}-description`} className="mt-2 text-base leading-normal">{description}</p>}
        </div>
        <Button variant="ghost" className="shrink-0" onClick={() => ref.current?.close()}>Đóng</Button>
      </div>
      <div className="min-w-0 p-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  );
}

export default function Modal(props: ModalProps) { return <Dialog {...props} />; }
