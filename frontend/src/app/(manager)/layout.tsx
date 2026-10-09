import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import { listMotels } from "@/lib/api/motels";
import Sidebar from "@/components/manager/sidebar";
import TopBar from "@/components/manager/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import CaptureServiceWorker from "@/components/manager/capture-service-worker";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get("manager_session")?.value) redirect("/login");
  const [manager, motels] = await Promise.all([getMe(), listMotels()]);
  return (
    <ToastProvider>
    <div className="flex min-h-dvh">
      <CaptureServiceWorker />
      <a href="#main-content" className="sr-only z-30 rounded-input bg-primary p-3 text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đến nội dung chính</a>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Suspense fallback={<div className="h-24 border-b border-border bg-surface" role="status">Đang tải điều hướng…</div>}>
          <TopBar manager={manager} motels={motels} />
        </Suspense>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
