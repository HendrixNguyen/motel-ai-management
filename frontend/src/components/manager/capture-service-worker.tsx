"use client";

import { useEffect } from "react";

export default function CaptureServiceWorker() {
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/capture-sw.js", { scope: "/" }); }, []);
  return null;
}
