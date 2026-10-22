"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import Button from "@/components/ui/button";
import { getRenterPushKey, getRenterPushSubscription, removeRenterPushSubscription, saveRenterPushSubscription } from "@/lib/api/renter";

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return bytes as Uint8Array<ArrayBuffer>;
}

export default function PushOptIn() {
  const [state, setState] = useState<"loading" | "unavailable" | "denied" | "off" | "on" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const update = (next: typeof state) => { if (active) setState(next); };
    void Promise.resolve().then(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { update("unavailable"); return; }
      const [config, saved] = await Promise.all([getRenterPushKey(), getRenterPushSubscription()]);
      if (!config.enabled || !config.publicKey) { update("off"); return; }
      if (Notification.permission === "denied") { update("denied"); return; }
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("service worker timeout")), 5000))]);
      const current = await registration.pushManager.getSubscription();
      if (current && saved.subscription?.endpoint === current.endpoint) update("on");
      else if (current) { update("error"); }
      else update("off");
    }).catch((error) => update(error instanceof ApiError && error.code === "UNAUTHORIZED" ? "unavailable" : "error"));
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") { setState(Notification.permission === "denied" ? "denied" : "off"); return; }
      const { publicKey, enabled } = await getRenterPushKey();
      if (!enabled || !publicKey) { setState("off"); return; }
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("service worker timeout")), 5000))]);
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      try { await saveRenterPushSubscription(subscription.toJSON()); }
      catch (error) { await subscription.unsubscribe(); throw error; }
      setState("on");
    } catch { setState("error"); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeRenterPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch { setState("error"); }
    finally { setBusy(false); }
  }

  if (state === "loading" || state === "unavailable" || state === "denied") return null;
  return <section className="space-y-2 rounded-card border border-border bg-surface p-4" aria-label="Thông báo thanh toán">
    <div><h2 className="font-semibold text-text">Thông báo thanh toán</h2><p className="text-sm text-text-muted">Nhận thông báo khi chứng từ hoặc hóa đơn được cập nhật. Không gửi nội dung hóa đơn trong thông báo.</p></div>
    {state === "on" ? <Button variant="secondary" pending={busy} onClick={disable}>Tắt thông báo</Button> : <Button variant="secondary" pending={busy} onClick={enable}>{state === "error" ? "Thử bật lại" : "Bật thông báo"}</Button>}
    {state === "error" && <p role="status" className="text-sm text-danger">Chưa cập nhật được cài đặt thông báo.</p>}
  </section>;
}
