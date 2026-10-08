"use client";

import { Toaster, toast as notifyToast } from "sonner";
import type { ReactNode } from "react";
import type { BadgeTone } from "./badge";

type ToastInput = { message: string; tone?: BadgeTone };

export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}<Toaster position="top-center" richColors closeButton /></>;
}

export function useToast() {
  return ({ message, tone = "success" }: ToastInput) => {
    if (tone === "danger") notifyToast.error(message);
    else if (tone === "warning") notifyToast.warning(message);
    else if (tone === "neutral") notifyToast.info(message);
    else notifyToast.success(message);
  };
}
