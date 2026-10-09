import Link from "next/link";
import { serverGetRenter } from "@/lib/api/renter.server";
import type { RenterTicket } from "@/lib/api/types";
import TicketForm from "@/components/renter/ticket-form";

const statusLabel: Record<RenterTicket["status"], string> = { open: "Mới", in_progress: "Đang xử lý", resolved: "Đã xử lý" };

export default async function RenterTicketsPage() {
  const tickets = await serverGetRenter<RenterTicket[]>("/api/renter/tickets");
  return <section className="space-y-6"><Link href="/portal" className="text-sm font-semibold text-primary underline">← Trang chủ</Link><div><p className="text-xs font-semibold text-text-muted">HỖ TRỢ</p><h1 className="mt-1 font-heading text-2xl font-bold text-text">Báo sự cố</h1><p className="mt-2 text-base text-text-muted">Gửi yêu cầu hỗ trợ đến chủ nhà.</p></div><TicketForm /><div className="space-y-3" aria-label="Yêu cầu đã gửi">{tickets.length ? tickets.map((ticket) => <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} className="block rounded-card border border-border p-4 focus-visible:outline-2 focus-visible:outline-primary"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-text">{ticket.description}</p><span className="shrink-0 rounded-full bg-canvas px-2 py-1 text-xs font-semibold text-text-muted">{statusLabel[ticket.status]}</span></div><p className="mt-2 text-sm text-text-muted">{ticket.category === "facilities" ? "Cơ sở vật chất" : ticket.category === "electricity" ? "Điện" : ticket.category === "water" ? "Nước" : "Khác"}</p></Link>) : <p className="rounded-card border border-border p-5 text-text-muted">Chưa có yêu cầu nào.</p>}</div></section>;
}
