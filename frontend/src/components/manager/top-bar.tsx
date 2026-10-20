"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CaptureQueueWarning from "@/components/manager/capture-queue-warning";
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
  const [currentMotels, setCurrentMotels] = useState({ source: motels, items: motels });
  const motelItems = currentMotels.source === motels ? currentMotels.items : motels;
  const [switching, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const search = searchParams.toString();
  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!accountMenu.current?.contains(event.target as Node) && !accountTrigger.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePress);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [accountOpen]);
  useEffect(() => {
    const update = (event: Event) => {
      const updated = (event as CustomEvent<MotelResponse>).detail;
      setCurrentMotels((current) => ({ ...current, items: current.items.map((motel) => motel.id === updated.id ? updated : motel) }));
    };
    window.addEventListener("motel-updated", update);
    return () => window.removeEventListener("motel-updated", update);
  }, []);
  useEffect(() => {
    if (motels.length && !searchParams.has("motel")) router.replace(motelHref(pathname, search, motels[0]!.id));
  }, [motels, pathname, router, search, searchParams]);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const event = new CustomEvent("capture:logout", { cancelable: true }); window.dispatchEvent(event);
      if (event.defaultPrevented) { setPending(false); return; }
      const { logout } = await import("@/lib/api/auth.client"); await logout();
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="border-b border-border bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(23,43,58,0.05)] sm:px-4 sm:py-3 lg:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 lg:flex lg:items-end lg:gap-4">
        <div className="hidden min-w-0 flex-1 lg:block"><p className="text-xs font-semibold text-text-muted">KHÔNG GIAN VẬN HÀNH</p><p className="mt-1 truncate font-heading text-lg font-semibold text-text">Theo dõi nhà trọ, hóa đơn và khách thuê</p></div>
        <div className="col-span-2 min-w-0 lg:col-span-1 lg:flex-1 lg:max-w-sm">
          <label htmlFor="motel-selector" className="mb-1 block text-sm font-semibold text-text sm:mb-2">Nhà trọ</label>
          <MotelSwitcher motels={motelItems} selectedId={selected} disabled={switching} onChange={(id) => { const event = new CustomEvent("capture:motel-switch", { cancelable: true, detail: id }); window.dispatchEvent(event); if (!event.defaultPrevented) startTransition(() => router.replace(motelHref(pathname, search, id))); }} />
        </div>
        <div className="relative col-start-2 row-start-1 lg:ml-auto">
          <button ref={accountTrigger} type="button" aria-label="Menu phụ, Tài khoản" aria-expanded={accountOpen} aria-controls="manager-account-menu" onClick={() => setAccountOpen((open) => !open)} className="flex min-h-11 cursor-pointer items-center rounded-input border border-border-strong px-3 text-sm font-semibold text-text hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Tài khoản
          </button>
          <div ref={accountMenu} id="manager-account-menu" role="group" aria-label="Tùy chọn tài khoản" hidden={!accountOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setAccountOpen(false); accountTrigger.current?.focus(); } }} className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-1.5rem)] space-y-3 rounded-card border border-border bg-surface p-4 shadow-lg sm:space-y-4">
            <p className="break-all text-sm">{manager.email}</p>
            <ThemeSelect />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button variant="secondary" onClick={handleLogout} pending={pending} pendingLabel="Đang đăng xuất…" className="w-full">Đăng xuất</Button>
          </div>
        </div>
      </div>
      {selected && <CaptureQueueWarning managerId={manager.id} motelId={selected} />}
    </header>
  );
}
