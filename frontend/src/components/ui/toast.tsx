"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Button from "./button";
import { badgeTones, type BadgeTone } from "./badge";

type ToastInput = { message: string; tone?: BadgeTone; critical?: boolean };
const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<(ToastInput & { id: number })[]>([]);
  const notify = useCallback((toast: ToastInput) => {
    const id = ++nextId.current;
    setToasts((items) => [...items, { ...toast, id }]);
  }, []);
  useEffect(() => {
    const timers = toasts.filter((toast) => !toast.critical && toast.tone !== "danger").map((toast) => window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== toast.id)), 3000));
    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);
  return <ToastContext value={notify}>
    {children}
<div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-2 overflow-y-auto">
       {toasts.map(({ id, message, tone = "success", critical }) => <div key={id} role={critical || tone === "danger" ? "alert" : "status"} aria-live={critical || tone === "danger" ? "assertive" : "polite"} aria-atomic="true" aria-labelledby={`toast-message-${id}`} className={`pointer-events-auto flex items-start gap-3 rounded-card border border-border p-3 shadow-lg ${badgeTones[tone]}`}>
          <p id={`toast-message-${id}`} className="min-w-0 flex-1 self-center text-base leading-normal [overflow-wrap:anywhere]">{message}</p>
        <Button variant="ghost" className="shrink-0" aria-label={`Đóng thông báo: ${message}`} onClick={() => setToasts((items) => items.filter((item) => item.id !== id))}>Đóng</Button>
      </div>)}
    </div>
  </ToastContext>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast requires ToastProvider");
  return notify;
}
