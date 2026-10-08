"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutRenter } from "@/lib/api/renter";
export default function RenterLogout() { const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState(""); return <div><button className="text-sm font-semibold text-primary underline disabled:opacity-60" disabled={pending} onClick={async () => { setPending(true); setError(""); try { await logoutRenter(); router.replace("/renter"); } catch { setError("Không thể đăng xuất. Thử lại."); setPending(false); } }}>{pending ? "Đang đăng xuất…" : "Đăng xuất"}</button>{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>; }
