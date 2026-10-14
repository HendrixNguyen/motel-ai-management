import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import { listMotels } from "@/lib/api/motels";
import Sidebar from "@/components/manager/sidebar";
import TopBar from "@/components/manager/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import CaptureServiceWorker from "@/components/manager/capture-service-worker";
import ManagerShell from "@/components/ui/manager-shell";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get("manager_session")?.value) redirect("/login");
  const [manager, motels] = await Promise.all([getMe(), listMotels()]);
  return (
    <ToastProvider>
     <>
       <CaptureServiceWorker />
       <a href="#main-content" className="sr-only z-30 rounded-input bg-primary p-3 text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đến nội dung chính</a>
       <ManagerShell sidebar={<Sidebar />} header={<Suspense fallback={<div className="h-24 border-b border-border bg-surface" role="status">Đang tải điều hướng…</div>}><TopBar manager={manager} motels={motels} /></Suspense>}>
         {children}
       </ManagerShell>
     </>
    </ToastProvider>
  );
}
