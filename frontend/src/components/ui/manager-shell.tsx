"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTiming, noMotion } from "@/lib/motion";
import AppShell from "./app-shell";

export default function ManagerShell({
  sidebar,
  header,
  children,
  bottomNav,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  bottomNav?: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AppShell sidebar={sidebar} bottomNav={bottomNav}>
      <div>
        {header}
        <motion.main
          id="main-content"
          data-motion="page"
          tabIndex={-1}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? noMotion
              : { duration: motionTiming.route, ease: [0.2, 0.8, 0.2, 1] }
          }
          className="w-full px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8"
        >
          {children}
        </motion.main>
      </div>
    </AppShell>
  );
}
