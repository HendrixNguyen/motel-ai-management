"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/api/client";
import { createRenterMagicLink } from "@/lib/api/renters.client";
import { buildAssistedZaloMessage } from "@/lib/assisted-zalo-message";
import {
  approvePaymentProof,
  confirmInvoiceCash,
  getManagerPaymentProof,
  markInvoiceOverdue,
  rejectPaymentProof,
} from "@/lib/api/billing.client";
import Button from "@/components/ui/button";
import type { InvoiceResponse, ManagerPaymentProof } from "@/lib/api/types";
import { formatVnd } from "@/lib/format/vnd";
import { paymentProofLabel } from "@/lib/payment-proof";

export default function InvoiceActions({
  motelId,
  invoice,
  bankAccount,
  renterPhone,
  billingPeriod,
  allowAssistedSend,
}: {
  motelId: string;
  invoice: InvoiceResponse;
  bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null;
  renterPhone?: string;
  billingPeriod: { month: number; year: number };
  allowAssistedSend: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [proof, setProof] = useState<ManagerPaymentProof | null>();
  const [proofLoading, setProofLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [sharing, setSharing] = useState(false);
  const pendingRef = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const refreshProof = useCallback(
    async (signal?: AbortSignal) => {
      setProofLoading(true);
      try {
        const current = await getManagerPaymentProof(motelId, invoice.id);
        if (!signal?.aborted) setProof(current);
      } catch (cause) {
        if (!signal?.aborted) {
          setProof(undefined);
          setMessage(
            cause instanceof ApiError && cause.status >= 400 && cause.status < 500
              ? cause.message
              : "Không thể tải chứng từ.",
          );
        }
      } finally {
        if (!signal?.aborted) setProofLoading(false);
      }
    },
    [invoice.id, motelId],
  );
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void refreshProof(controller.signal));
    return () => controller.abort();
  }, [refreshProof]);
  useEffect(() => {
    if (!invoice.qrCodeData || !canvas.current) return;
    void QRCode.toCanvas(canvas.current, invoice.qrCodeData, { width: 220, margin: 2 });
  }, [invoice.qrCodeData]);

  const proofPending = proof?.status === "pending";
  const settled = invoice.paymentStatus === "paid";
  const transitionPending = pending || proofLoading;

  async function prepareZaloMessage() {
    if (sharing) return;
    if (!renterPhone) {
      setMessage("Không tìm thấy số điện thoại người thuê để mở Zalo.");
      return;
    }
    const chatWindow = window.open("about:blank", "_blank");
    if (!chatWindow) {
      setMessage("Trình duyệt đã chặn cửa sổ Zalo. Cho phép cửa sổ bật lên rồi thử lại.");
      return;
    }
    setSharing(true);
    setMessage(undefined);
    try {
      const { url } = await createRenterMagicLink(motelId, invoice.renterId);
      const message = buildAssistedZaloMessage({
        renter: { phone: renterPhone },
        invoice,
        month: billingPeriod.month,
        year: billingPeriod.year,
        portalUrl: url,
      });
      await navigator.clipboard.writeText(message.text);
      chatWindow.location.href = message.url;
      setMessage(
        "Đã sao chép nội dung. Kiểm tra đúng người nhận trong Zalo, dán tin nhắn rồi tự gửi. Tin chưa được gửi.",
      );
    } catch (cause) {
      chatWindow.close();
      setMessage(
        cause instanceof ApiError && cause.status >= 400 && cause.status < 500
          ? cause.message
          : GENERIC_ERROR_MESSAGE,
      );
    } finally {
      setSharing(false);
    }
  }

  async function transition(action: "approve" | "reject" | "cash" | "overdue") {
    if (pendingRef.current || (action === "reject" && !reason.trim())) return;
    if (action === "cash" && !window.confirm("Xác nhận đã nhận tiền mặt cho hóa đơn này?")) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(undefined);
    try {
      if (action === "approve") {
        const result = await approvePaymentProof(motelId, invoice.id);
        setMessage(`Đã ghi nhận thanh toán qua chuyển khoản. Trạng thái: ${result.paymentStatus}.`);
      } else if (action === "reject") {
        await rejectPaymentProof(motelId, invoice.id, reason);
        setMessage("Chứng từ đã bị từ chối. Hóa đơn vẫn chưa thanh toán.");
        setReason("");
      } else if (action === "cash") {
        const result = await confirmInvoiceCash(motelId, invoice.id);
        setMessage(`Đã xác nhận thanh toán bằng tiền mặt. Trạng thái: ${result.paymentStatus}.`);
      } else {
        await markInvoiceOverdue(motelId, invoice.id);
        setMessage("Đã đánh dấu quá hạn");
      }
      await refreshProof();
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof ApiError && cause.status === 409
          ? "Trạng thái hóa đơn đã thay đổi. Đang tải lại dữ liệu mới nhất."
          : cause instanceof ApiError && cause.status < 500
            ? cause.message
            : "Không thể cập nhật thanh toán. Vui lòng thử lại.",
      );
      if (cause instanceof ApiError && cause.status === 409) {
        await refreshProof();
        router.refresh();
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-4 grid min-w-0 gap-4 border-t border-border pt-4 sm:grid-cols-2">
      {allowAssistedSend && invoice.paymentStatus !== "paid" && (
        <Button onClick={() => void prepareZaloMessage()} disabled={sharing}>
          {sharing ? "Đang chuẩn bị…" : "Chuẩn bị tin nhắn Zalo"}
        </Button>
      )}
      {invoice.qrCodeData ? (
        <details className="min-w-0">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-input px-3 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Xem mã QR
          </summary>
          <div className="mt-2 flex min-w-0 flex-wrap items-start gap-4 rounded-input border border-border bg-canvas p-3">
            <canvas
              ref={canvas}
              className="max-w-full"
              role="img"
              aria-label={`Mã QR thanh toán hóa đơn phòng ${invoice.roomName}`}
            />
            <dl className="min-w-0 space-y-2 text-sm text-text">
              <div>
                <dt className="text-text-muted">Người nhận</dt>
                <dd className="break-words font-medium">
                  {bankAccount?.accountName ?? "Chưa cấu hình"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Số tài khoản</dt>
                <dd className="break-all font-medium">
                  {bankAccount?.accountNumber ?? "Chưa cấu hình"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Số tiền</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums">
                  {formatVnd(invoice.totalAmount)}
                </dd>
              </div>
            </dl>
          </div>
        </details>
      ) : (
        <span className="text-sm text-text-muted">Chưa có mã QR</span>
      )}
      <div className="min-w-0 space-y-3 sm:col-span-2">
        {proofLoading ? (
          <p role="status" className="text-sm text-text-muted">
            Đang tải chứng từ…
          </p>
        ) : proof === undefined ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">
              Không thể tải chứng từ.
            </p>
            <Button
              variant="ghost"
              onClick={() => void refreshProof()}
              disabled={transitionPending}
            >
              Tải lại chứng từ
            </Button>
          </div>
        ) : (
          proof && (
            <section
              aria-label="Chứng từ thanh toán"
              className="space-y-3 rounded-card border border-border bg-canvas p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-text">Chứng từ chuyển khoản</h3>
                <span
                  role="status"
                  className="rounded-full bg-warning-bg px-3 py-1 text-sm font-medium text-warning"
                >
                  {paymentProofLabel(proof.status)}
                </span>
              </div>
              <Image
                src={proof.signedUrl}
                alt="Chứng từ thanh toán"
                width={640}
                height={480}
                unoptimized
                className="max-h-64 w-full rounded-input object-contain"
              />
              <p className="break-words text-sm text-text-muted">
                Gửi lúc {new Date(proof.submittedAt).toLocaleString("vi-VN")}
              </p>
              {proof.rejectionReason && (
                <p className="break-words text-sm text-danger">
                  Lý do từ chối: {proof.rejectionReason}
                </p>
              )}
              {!settled && proofPending && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <label
                    className="w-full text-sm font-semibold text-text"
                    htmlFor={`reject-reason-${invoice.id}`}
                  >
                    Lý do từ chối
                  </label>
                  <textarea
                    id={`reject-reason-${invoice.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    required
                    disabled={transitionPending}
                    className="min-h-20 w-full min-w-0 rounded-input border border-border p-3 text-text focus-visible:outline-2 focus-visible:outline-primary"
                  />
                  <Button
                    variant="danger"
                    pending={pending}
                    pendingLabel="Đang từ chối"
                    onClick={() => void transition("reject")}
                    disabled={transitionPending || !reason.trim()}
                  >
                    Từ chối chứng từ
                  </Button>
                  <Button
                    pending={pending}
                    pendingLabel="Đang duyệt"
                    onClick={() => void transition("approve")}
                    disabled={transitionPending}
                  >
                    Duyệt chứng từ
                  </Button>
                </div>
              )}
            </section>
          )
        )}
        {!settled && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              pending={pending}
              pendingLabel="Đang xác nhận"
              onClick={() => void transition("cash")}
              disabled={transitionPending}
            >
              Xác nhận đã nhận tiền mặt
            </Button>
            {invoice.paymentStatus === "unpaid" && (
              <Button
                variant="ghost"
                pending={pending}
                pendingLabel="Đang cập nhật"
                onClick={() => void transition("overdue")}
                disabled={transitionPending}
              >
                Đánh dấu quá hạn
              </Button>
            )}
          </div>
        )}
        {message && (
          <p
            role={message.includes("thay đổi") ? "alert" : "status"}
            className="max-w-full break-words text-sm text-text-muted"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
