"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { finalizeBillingPeriod } from "@/lib/api/billing.client";

export default function FinalizePeriod({ motelId, periodId, disabled }: { motelId: string; periodId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string>(); const router = useRouter();
  async function submit() { if (disabled || pending || !window.confirm("Chốt kỳ sẽ khóa chỉ số và hóa đơn. Hệ thống không gửi thông báo cho khách thuê. Tiếp tục?")) return; setPending(true); setError(undefined); try { await finalizeBillingPeriod(motelId, periodId); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể chốt kỳ hóa đơn"); } finally { setPending(false); } }
  return <div className="space-y-2">{!disabled && <Button onClick={submit} disabled={pending}>Chốt kỳ hóa đơn</Button>}{error && <p role="alert" className="text-danger">{error}</p>}</div>;
}
