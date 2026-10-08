"use client";
import { useRouter } from "next/navigation";
import { logoutRenter } from "@/lib/api/renter";
export default function RenterLogout() { const router = useRouter(); return <button className="text-sm font-semibold text-primary underline" onClick={async () => { await logoutRenter(); router.replace("/renter"); }}>Đăng xuất</button>; }
