"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <MotionPreference>{children}</MotionPreference>
    </MotionConfig>
  );
}

function MotionPreference({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div data-reduced-motion={reduced ? "true" : undefined}>{children}</div>;
}
