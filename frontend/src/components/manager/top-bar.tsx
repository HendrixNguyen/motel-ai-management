"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/lib/api/auth.client";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import type { ManagerMeResponse, MotelResponse } from "@/lib/api/types";
import { motelHref } from "@/lib/motel-navigation";
import Button from "@/components/ui/button";
import ThemeSelect from "@/components/ui/theme-select";
import MotelSwitcher from "@/components/ui/motel-switcher";

export default function TopBar({ manager, motels }: { manager: ManagerMeResponse; motels: MotelResponse[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("motel") ?? motels[0]?.id;
  const [switching, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const search = searchParams.toString();

  useEffect(() => {
    if (!searchParams.has("motel") && motels[0]) router.replace(motelHref(pathname, search, motels[0].id));
  }, [motels, pathname, router, search, searchParams]);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="border-b border-border bg-surface px-4 py-3 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-end gap-4">
        <div className="hidden min-w-0 flex-1 lg:block"><p className="text-xs font-semibold text-text-muted">KHÔNG GIAN VẬN HÀNH</p><p className="mt-1 truncate font-heading text-lg font-semibold text-text">Theo dõi nhà trọ, hóa đơn và khách thuê</p></div>
        <div className="min-w-0 flex-1 lg:max-w-sm">
          <label htmlFor="motel-selector" className="mb-2 block text-sm font-semibold text-text">Nhà trọ</label>
           <MotelSwitcher motels={motels} selectedId={selected} disabled={switching} onChange={(id) => startTransition(() => router.replace(motelHref(pathname, search, id)))} />
        </div>
        <details className="relative shrink-0 lg:ml-auto">
          <summary aria-label="Menu phụ, Tài khoản" className="flex min-h-11 cursor-pointer items-center rounded-input border border-border-strong px-3 text-sm font-semibold text-text hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="lg:hidden">Menu phụ</span><span className="hidden lg:inline">Tài khoản</span>
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] space-y-4 rounded-card border border-border bg-surface p-4 shadow-lg">
             <p className="text-sm wrap-anywhere">{manager.email}</p>
             <ThemeSelect />
             {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            <Button variant="secondary" onClick={handleLogout} pending={pending} pendingLabel="Đang đăng xuất…" className="w-full">Đăng xuất</Button>
          </div>
        </details>
      </div>
    </header>
  );
}
