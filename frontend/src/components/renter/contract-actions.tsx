"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { requestRenterContractOtp, verifyRenterContractOtp } from "@/lib/api/renter";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import type { RenterContract } from "@/lib/api/types";

export default function ContractActions({ contract }: { contract: RenterContract }) {
  const timerRef = useRef<number | undefined>(undefined); const router = useRouter(); const [otp, setOtp] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [cooldown, setCooldown] = useState(0);
  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);
  async function send() { if (cooldown > 0) return; setError(""); setPending(true); try { await requestRenterContractOtp(contract.id); setMessage("Mã OTP đã được gửi qua Zalo."); setCooldown(300); timerRef.current = window.setInterval(() => setCooldown((value) => { if (value <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); return 0; } return value - 1; }), 1000); } catch (cause) { setError(cause instanceof ApiError && cause.code === "RATE_LIMITED" ? `Bạn đã yêu cầu mã. Thử lại sau ${String(cause.details?.retryAfterSeconds ?? "vài phút")} giây.` : cause instanceof ApiError && cause.code === "OTP_EXPIRED" ? "Mã OTP đã hết hạn. Hãy yêu cầu mã mới." : cause instanceof ApiError && cause.code === "OTP_INVALID" ? "Mã OTP không đúng hoặc đã hết lượt thử." : cause instanceof ApiError ? cause.message : "Đã xảy ra lỗi hệ thống"); } finally { setPending(false); } }
  async function verify() { setError(""); setPending(true); try { await verifyRenterContractOtp(contract.id, otp); setMessage("Đã ký hợp đồng."); router.refresh(); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Đã xảy ra lỗi hệ thống"); } finally { setPending(false); } }
  return <div className="space-y-4">{message && <p role="status" className="text-sm text-success">{message}</p>}{error && <p role="alert" tabIndex={-1} className="text-sm text-danger">{error}</p>}{contract.status === "draft" && !contract.otpSignedAt && <><Button pending={pending} onClick={send} disabled={cooldown > 0}>{cooldown > 0 ? `Gửi lại sau ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : "Gửi mã OTP"}</Button><Field id="otp" label="Mã OTP" hint="Mã gồm 6 chữ số, có hiệu lực 5 phút." error={error}>{(props) => <input {...props} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} />}</Field><Button pending={pending} onClick={verify} disabled={otp.length !== 6}>Xác nhận ký</Button></>}</div>;
}
