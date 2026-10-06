"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import CopyButton from "@/components/ui/copy-button";
import { createMagicLinkSession } from "@/lib/renter-magic-link";

export default function RenterMagicLink({ motelId, renterId }: { motelId: string; renterId: string }) {
  const [session] = useState(() => createMagicLinkSession(motelId, renterId));
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const router = useRouter();
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);

  async function create() {
    setPending(true); setUrl(undefined); setError(undefined);
    const result = await session.submit();
    if (!active.current) return;
    setPending(false);
    if (result.ok) setUrl(result.url);
    else if (result.status === 401) { router.replace("/login"); router.refresh(); }
    else setError(result.error);
  }

  return <div className="min-w-0 space-y-4">
    <Button pending={pending} pendingLabel="Đang tạo…" onClick={create}>Tạo magic link</Button>
    {error && <div ref={summary} role="alert" tabIndex={-1} className="rounded-input border border-danger bg-danger-bg p-3 text-danger focus:outline-2 focus:outline-offset-2 focus:outline-danger">{error}</div>}
    {url && <div className="min-w-0 space-y-3">
      <label htmlFor={id} className="block text-sm font-semibold text-text">Magic link</label>
      <input id={id} readOnly value={url} className="min-h-11 w-full min-w-0 rounded-input border border-border bg-canvas px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
      <CopyButton key={url} value={url} label="Sao chép magic link" />
      <p role="status" className="text-sm text-text-muted">Đã tạo liên kết. Sao chép và gửi riêng cho khách thuê.</p>
    </div>}
  </div>;
}
