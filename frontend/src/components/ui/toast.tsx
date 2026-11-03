"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { toast, Toaster } from "sonner";
import type { BadgeTone } from "./badge";

type ToastInput = { message: string; tone?: BadgeTone; critical?: boolean };
let announcementId = 0;
const announcements: { id: number; message: string; tone: BadgeTone; critical: boolean }[] = [];
const ToastContext = createContext<((toastInput: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const notify = useCallback(({ message, tone = "success", critical = false }: ToastInput) => {
    const id = ++announcementId;
    const options = {
      id,
      duration: critical || tone === "danger" ? Infinity : 3000,
      onDismiss: () => dismissAnnouncement(id),
      onAutoClose: () => dismissAnnouncement(id),
    };
    announcements.push({ id, message, tone, critical });
    const announced = () => window.dispatchEvent(new window.CustomEvent("sonner:toast"));
    if (tone === "danger") toast.error(message, options);
    else if (tone === "warning") toast.warning(message, options);
    else if (tone === "success") toast.success(message, options);
    else toast(message, options);
    queueMicrotask(announced);
  }, []);
  return (
    <ToastContext value={notify}>
      {children}
      <SonnerAnnouncements />
      <Toaster
        position="top-right"
        visibleToasts={5}
        data-motion="toast-layer"
        aria-live="polite"
        aria-relevant="additions text"
        expand={false}
        duration={3000}
        containerAriaLabel="Thông báo"
        customAriaLabel="Thông báo"
        className="!w-[min(32rem,calc(100vw-2rem))] !max-w-none [&_[data-sonner-toast]]:!relative [&_[data-sonner-toast]]:!inset-auto [&_[data-sonner-toast]]:!flex [&_[data-sonner-toast]]:!min-h-11 [&_[data-sonner-toast]]:!w-full [&_[data-sonner-toast]]:!items-start [&_[data-sonner-toast]]:!gap-3 [&_[data-sonner-toast]]:!rounded-card [&_[data-sonner-toast]]:!border-border [&_[data-sonner-toast]]:!bg-surface [&_[data-sonner-toast]]:!p-3 [&_[data-sonner-toast]]:!text-base [&_[data-sonner-toast]]:!leading-normal [&_[data-sonner-toast]]:!text-text-body [&_[data-sonner-toast]]:!shadow-lg [&_[data-sonner-toast]]:!animate-[toast-enter_160ms_ease-out_both] [&_[data-sonner-toast]]:![animation-duration:160ms] [&_[data-sonner-toast]]:![animation-name:toast-enter] motion-reduce:[&_[data-sonner-toast]]:!animate-none [&_[data-sonner-toast]]:![overflow-wrap:anywhere] [&_[data-sonner-toast]>div]:!min-w-0 [&_[data-sonner-toast]>div]:!flex-1 [&_[data-sonner-toast]>button]:!static [&_[data-sonner-toast]>button]:!ml-auto [&_[data-sonner-toast]>button]:!h-11 [&_[data-sonner-toast]>button]:!min-w-12 [&_[data-sonner-toast]>button]:!min-h-12 [&_[data-sonner-toast]>button]:!w-auto [&_[data-sonner-toast]>button]:!shrink-0 [&_[data-sonner-toast]>button]:!translate-x-0 [&_[data-sonner-toast]>button]:!translate-y-0 [&_[data-sonner-toast]>button]:!border-border-strong [&_[data-sonner-toast]>button]:!bg-surface [&_[data-sonner-toast]>button]:!px-3 [&_[data-sonner-toast]>button]:!text-text [&_[data-sonner-toast]_[data-content]]:!min-w-0 [&_[data-sonner-toast]_[data-content]]:!flex-1 [&_[data-sonner-toast]_[data-content]]:!self-center"
        style={{ "--width": "min(32rem,calc(100vw-2rem))", "--offset": "1rem" } as CSSProperties}
        closeButton
        richColors
        toastOptions={{
          closeButtonAriaLabel: "Đóng thông báo",
          classNames: {
            toast: "!border-border !bg-surface !text-text-body !shadow-lg",
            title: "!text-text-body",
            description: "!text-text-muted",
            closeButton: "!border-border-strong !bg-surface !text-text",
          },
        }}
      />
    </ToastContext>
  );
}

function dismissAnnouncement(id: number) {
  const index = announcements.findIndex((item) => item.id === id);
  if (index >= 0) announcements.splice(index, 1);
  window.dispatchEvent(new window.CustomEvent("sonner:toast"));
}

function SonnerAnnouncements() {
  const [items, setItems] = useState(announcements);
  useEffect(() => {
    const refresh = () => setItems(announcements.slice());
    window.addEventListener("sonner:toast", refresh);
    return () => window.removeEventListener("sonner:toast", refresh);
  }, []);
  return (
    <div role="region" aria-label="Thông báo" className="sr-only">
      {items.map(({ id, message, tone, critical }) => (
        <span
          key={id}
          role={tone === "danger" || critical ? "alert" : "status"}
          aria-live={tone === "danger" || critical ? "assertive" : "polite"}
          aria-atomic="true"
          aria-labelledby={`toast-message-${id}`}
        >
          <p id={`toast-message-${id}`}>{message}</p>
        </span>
      ))}
    </div>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast requires ToastProvider");
  return notify;
}
