"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaptureQueue, clearCaptureQueue } from "@/lib/capture/queue";

export default function CaptureQueueWarning({ managerId, motelId }: { managerId: string; motelId: string }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(0);
  const [legacy, setLegacy] = useState(false);
  const queue = useMemo(() => new CaptureQueue(managerId), [managerId]);
  const [targetMotel, setTargetMotel] = useState<string>();
  const [logoutPending, setLogoutPending] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [clearError, setClearError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([queue.list(), queue.hasLegacyRows()]).then(([items, hasLegacy]) => { if (!cancelled) { setDirty(items.filter((item) => item.status !== "sent").length); setLegacy(hasLegacy); } }).catch(() => { if (!cancelled) { setDirty(0); setLegacy(false); } });
    return () => { cancelled = true; };
  }, [managerId, motelId, queue]);
  useEffect(() => {
    const onSwitch = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (dirty > 0 && next !== motelId) { event.preventDefault(); setTargetMotel(next); }
    };
    window.addEventListener("capture:motel-switch", onSwitch);
    return () => window.removeEventListener("capture:motel-switch", onSwitch);
  }, [dirty, motelId]);
  useEffect(() => {
    const onLogout = (event: Event) => {
      if (dirty > 0) { event.preventDefault(); setLogoutPending(true); }
    };
    window.addEventListener("capture:logout", onLogout);
    return () => window.removeEventListener("capture:logout", onLogout);
  }, [dirty]);
  useEffect(() => {
    if (!targetMotel) return;
    const params = new URLSearchParams(window.location.search); params.set("motel", targetMotel);
    router.push(`${window.location.pathname}?${params.toString()}`);
  }, [router, targetMotel]);
  useEffect(() => {
    if (!logoutPending) return;
    let cancelled = false;
    import("@/lib/api/auth.client").then(({ logout }) => logout()).then(() => {
      if (!cancelled) router.replace("/login");
    }).catch(() => { if (!cancelled) setLogoutPending(false); });
    return () => { cancelled = true; };
  }, [logoutPending, router]);
  if (!dirty && !legacy) return null;
  return <aside aria-label="Chỉ số chưa đồng bộ" className="border-t border-warning bg-warning-bg px-4 py-2 text-sm text-warning">
    <p role="status">{legacy ? "Có dữ liệu chỉ số cũ chưa gắn với tài khoản hiện tại. Dữ liệu bị cách ly và sẽ không được đồng bộ tự động." : `Có ${dirty} mục nhập chỉ số chưa đồng bộ.`} Khi đổi nhà trọ, dữ liệu vẫn được giữ trong hàng đợi riêng từng nhà trọ. Khi đăng xuất, có thể chọn giữ lại trên thiết bị hoặc xóa.</p>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="min-h-11 underline" onClick={() => setClearPending(true)}>Quản lý dữ liệu ngoại tuyến</button></div>
    {clearPending && <div role="alertdialog" aria-modal="true" aria-labelledby="capture-clear-title" aria-describedby="capture-clear-description" className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"><section className="w-full max-w-md rounded-card border border-border bg-surface p-5 text-text"><h2 id="capture-clear-title" className="font-heading text-lg font-semibold">Quản lý dữ liệu ngoại tuyến</h2><p id="capture-clear-description" className="mt-2 text-text-muted">{legacy ? "Dữ liệu cũ được cách ly, không gắn với tài khoản nào và không tự đồng bộ." : `Đang có ${dirty} mục chưa đồng bộ.`} Đăng xuất mặc định giữ dữ liệu theo tài khoản trên thiết bị. Chỉ xóa khi chọn rõ bên dưới.</p>{clearError && <p role="alert" className="mt-2 text-danger">{clearError}</p>}<div className="mt-4 flex justify-end gap-2"><button className="min-h-11 rounded-input border border-border px-4" onClick={() => setClearPending(false)}>Giữ lại</button><button className="min-h-11 rounded-input bg-danger px-4 font-semibold text-white" onClick={() => void (async () => { try { await clearCaptureQueue(managerId); setDirty(0); setClearPending(false); setClearError(""); } catch { setClearError("Không thể xóa dữ liệu khỏi thiết bị này"); } })()}>Xóa dữ liệu của tài khoản này</button></div></section></div>}
  </aside>;
}
