"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/shadcn/button";
import { CaptureQueue, clearCaptureQueue } from "@/lib/capture/queue";

export default function CaptureQueueWarning({
  managerId,
  motelId,
}: {
  managerId: string;
  motelId: string;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(0);
  const [legacy, setLegacy] = useState(false);
  const queue = useMemo(() => new CaptureQueue(managerId), [managerId]);
  const [targetMotel, setTargetMotel] = useState<string>();
  const [logoutPending, setLogoutPending] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [clearError, setClearError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([queue.list(), queue.hasLegacyRows()])
      .then(([items, hasLegacy]) => {
        if (!cancelled) {
          setDirty(items.filter((item) => item.status !== "sent").length);
          setLegacy(hasLegacy);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDirty(0);
          setLegacy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [managerId, motelId, queue]);
  useEffect(() => {
    const onSwitch = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (dirty > 0 && next !== motelId) {
        event.preventDefault();
        setTargetMotel(next);
      }
    };
    window.addEventListener("capture:motel-switch", onSwitch);
    return () => window.removeEventListener("capture:motel-switch", onSwitch);
  }, [dirty, motelId]);
  useEffect(() => {
    const onLogout = (event: Event) => {
      if (dirty > 0) {
        event.preventDefault();
        setLogoutPending(true);
      }
    };
    window.addEventListener("capture:logout", onLogout);
    return () => window.removeEventListener("capture:logout", onLogout);
  }, [dirty]);
  useEffect(() => {
    if (!targetMotel) return;
    const params = new URLSearchParams(window.location.search);
    params.set("motel", targetMotel);
    router.push(`${window.location.pathname}?${params.toString()}`);
  }, [router, targetMotel]);
  useEffect(() => {
    if (!logoutPending) return;
    let cancelled = false;
    import("@/lib/api/auth.client")
      .then(({ logout }) => logout())
      .then(() => {
        if (!cancelled) router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) setLogoutPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logoutPending, router]);
  if (!dirty && !legacy) return null;
  const message = legacy
    ? "Có dữ liệu chỉ số cũ chưa gắn với tài khoản hiện tại. Dữ liệu bị cách ly và sẽ không được đồng bộ tự động."
    : `Có ${dirty} mục nhập chỉ số chưa đồng bộ.`;
  const clearable = dirty > 0 || legacy;

  async function clearQueue() {
    try {
      await clearCaptureQueue(managerId);
      setDirty(0);
      setLegacy(false);
      setClearPending(false);
      setClearError("");
    } catch {
      setClearError("Không thể xóa dữ liệu khỏi thiết bị này");
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        aria-label={`Thông báo dữ liệu ngoại tuyến: ${message}`}
        aria-haspopup="dialog"
        aria-expanded={noticeOpen}
        className="fixed right-4 top-4 z-40 rounded-full border border-warning bg-warning-bg p-2 text-warning shadow-lg lg:right-8 lg:top-5"
        onClick={() => setNoticeOpen((open) => !open)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span className="sr-only">{message}</span>
        {dirty > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1 text-xs leading-5 text-white"
          >
            {dirty}
          </span>
        )}
      </Button>
      {noticeOpen && (
        <aside
          role="status"
          aria-label="Thông báo dữ liệu ngoại tuyến"
          className="fixed right-4 top-16 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-warning bg-warning-bg p-4 text-warning shadow-lg lg:right-8 lg:top-20"
        >
          <p className="font-semibold">Dữ liệu nhập chỉ số</p>
          <p className="mt-2 text-sm">{message}</p>
          <p className="mt-2 text-sm">
            Chỉ số được lưu riêng theo từng nhà trọ. Khi đổi nhà trọ, hàng đợi của từng nhà trọ vẫn
            được giữ. Khi đăng xuất, dữ liệu được giữ trên thiết bị trừ khi bạn chọn xóa.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>
              Đóng
            </Button>
            {clearable && (
              <Button
                variant="destructive"
                onClick={() => {
                  setClearError("");
                  setClearPending(true);
                }}
              >
                Quản lý dữ liệu
              </Button>
            )}
          </div>
        </aside>
      )}
      <Modal
        open={clearPending}
        data-testid="capture-clear-dialog"
        onClose={() => setClearPending(false)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        title="Xóa dữ liệu nhập chỉ số"
        description="Dữ liệu chưa đồng bộ sẽ không thể khôi phục sau khi xóa."
        data-autofocus="preserve"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearPending(false)}>
              Giữ lại
            </Button>
            <Button variant="destructive" onClick={() => void clearQueue()}>
              Xóa dữ liệu của tài khoản này
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-text-body">
          <p role="status" className="font-semibold text-warning">
            {message}
          </p>
          {clearError && (
            <p role="alert" className="text-danger">
              {clearError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
