"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { acceptRenterContractConsent } from "@/lib/api/renter";
import { Button } from "@/components/ui/shadcn/button";
import type { RenterContract } from "@/lib/api/types";

export default function ContractActions({ contract }: { contract: RenterContract }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(contract.consentAcceptedAt !== null);
  const [reviewedVersion, setReviewedVersion] = useState(contract.termsVersion);

  async function sign() {
    if (!consent || !confirmed || reviewedVersion !== contract.termsVersion || pending || signed)
      return;
    setPending(true);
    setError("");
    try {
      await acceptRenterContractConsent(contract.id, contract.termsVersion);
      setSigned(true);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không thể xác nhận hợp đồng. Vui lòng thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  if (signed || contract.status === "active")
    return (
      <p
        role="status"
        className="rounded-input bg-success-bg p-3 text-sm font-semibold text-success"
      >
        Hợp đồng đã được xác nhận.
      </p>
    );
  if (contract.status !== "draft") return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Đăng nhập bằng liên kết cá nhân để xác nhận bạn đã đọc hợp đồng. Liên kết này xác thực phiên
        truy cập, không thay thế việc xác minh danh tính độc lập.
      </p>
      {reviewedVersion !== contract.termsVersion && (
        <div
          role="alert"
          className="space-y-2 rounded-input border border-warning bg-warning-bg p-3 text-sm text-warning"
        >
          <p>Điều khoản hợp đồng đã thay đổi. Đọc lại bản mới trước khi đồng ý.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setConsent(false);
              setConfirmed(false);
              setReviewedVersion(contract.termsVersion);
            }}
          >
            Đã đọc bản mới
          </Button>
        </div>
      )}
      <label className="flex min-h-11 items-start gap-3 text-base text-text-body">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 min-h-5 min-w-5"
        />
        <span>Tôi đã đọc và đồng ý với toàn bộ điều khoản hợp đồng này.</span>
      </label>
      <label className="flex min-h-11 items-start gap-3 text-base text-text-body">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 min-h-5 min-w-5"
        />
        <span>Xác nhận ký hợp đồng và kích hoạt các điều khoản đã hiển thị.</span>
      </label>
      {error && (
        <p role="alert" tabIndex={-1} className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        aria-busy={pending}
        onClick={sign}
        disabled={pending || !consent || !confirmed || signed}
      >
        {pending ? "Đang xác nhận…" : "Xác nhận ký hợp đồng"}
      </Button>
    </div>
  );
}
