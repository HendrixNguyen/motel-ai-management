"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/capture-sw.js", { scope: "/" }).then((registration) => { void registration.update(); }).catch(() => undefined);
  }, []);
  return null;
}
