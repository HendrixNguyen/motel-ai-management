"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CaptureQueueWarning from "@/components/manager/capture-queue-warning";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import type { ManagerMeResponse, MotelResponse } from "@/lib/api/types";
import { motelHref } from "@/lib/motel-navigation";
import { Button } from "@/components/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";
import ThemeSelect from "@/components/ui/theme-select";
import MotelSwitcher from "@/components/ui/motel-switcher";

const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "";

export default function TopBar({
  manager,
  motels,
}: {
  manager: ManagerMeResponse;
  motels: MotelResponse[];
}) {
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
  const search = searchParams.toString();
  useEffect(() => {
    const update = (event: Event) => {
      const updated = (event as CustomEvent<MotelResponse>).detail;
      setCurrentMotels((current) => ({
        ...current,
        items: current.items.map((motel) => (motel.id === updated.id ? updated : motel)),
      }));
    };
    window.addEventListener("motel-updated", update);
    return () => window.removeEventListener("motel-updated", update);
  }, []);
  useEffect(() => {
    if (motels.length && !searchParams.has("motel"))
      router.replace(motelHref(pathname, search, motels[0]!.id));
  }, [motels, pathname, router, search, searchParams]);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const event = new CustomEvent("capture:logout", { cancelable: true });
      window.dispatchEvent(event);
      if (event.defaultPrevented) {
        setPending(false);
        return;
      }
      const { logout } = await import("@/lib/api/auth.client");
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
    <header className="border-b border-border bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(23,43,58,0.05)] sm:px-4 sm:py-3 lg:px-8">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Không gian vận hành
          </p>
          <p className="mt-0.5 truncate font-heading text-base font-semibold text-text">
            Theo dõi nhà trọ, hóa đơn và khách thuê
          </p>
        </div>
        <div className="min-w-[12rem] flex-1 sm:w-64 sm:flex-none lg:flex-1 lg:max-w-sm">
          <MotelSwitcher
            motels={motelItems}
            selectedId={selected}
            disabled={switching}
            onChange={(id) => {
              const event = new CustomEvent("capture:motel-switch", {
                cancelable: true,
                detail: id,
              });
              window.dispatchEvent(event);
              if (!event.defaultPrevented)
                startTransition(() => router.replace(motelHref(pathname, search, id)));
            }}
          />
        </div>
        <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              aria-label="Menu phụ, Tài khoản"
              aria-controls="manager-account-menu"
              aria-expanded={accountOpen}
            >
              Tài khoản
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-1.5rem)] p-4">
            <DropdownMenuItem
              disabled
              className="h-auto min-h-11 max-w-[calc(100vw-3rem)] cursor-default whitespace-normal px-0 focus:bg-transparent focus:text-text"
            >
              <span className="break-all text-sm">{manager.email}</span>
            </DropdownMenuItem>
            <div className="px-2 py-2" role="none">
              <ThemeSelect />
            </div>
            {buildVersion && (
              <DropdownMenuItem
                disabled
                className="h-auto min-h-11 cursor-default whitespace-normal px-2 focus:bg-transparent focus:text-text"
              >
                <p className="font-mono text-xs text-text-muted" data-testid="build-version">
                  Build {buildVersion}
                </p>
              </DropdownMenuItem>
            )}
            <div className="space-y-3 sm:space-y-4">
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => {
                  void handleLogout();
                }}
                className="px-2 py-2 focus:bg-transparent"
              >
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  aria-busy={pending}
                  className="w-full"
                >
                  {pending ? "Đang đăng xuất…" : "Đăng xuất"}
                </Button>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {selected && <CaptureQueueWarning managerId={manager.id} motelId={selected} />}
    </header>
  );
}
