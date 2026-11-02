"use client";

import { useEffect } from "react";
import { refreshManagerSession } from "@/lib/api/client";

export default function SessionRefresh() {
  useEffect(() => {
    void refreshManagerSession();
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshManagerSession();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
  return null;
}
