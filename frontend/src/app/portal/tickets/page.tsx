import { serverGetRenter } from "@/lib/api/renter.server";
import type { RenterTicket } from "@/lib/api/types";
import TicketForm from "@/components/renter/ticket-form";

export default async function RenterTicketsPage() {
  const tickets = await serverGetRenter<RenterTicket[]>("/api/renter/tickets");
  return <section className="space-y-6"><div><h1 className="font-heading text-2xl font-bold text-text">Báo sự cố</h1><p className="mt-2 text-base text-text-muted">Gửi yêu cầu hỗ trợ đến chủ nhà.</p></div><TicketForm /><div className="space-y-3">{tickets.map((ticket) => <article key={ticket.id} className="rounded-card border border-border p-4"><p className="font-semibold text-text">{ticket.description}</p><p className="mt-1 text-sm text-text-muted">{ticket.status === "open" ? "Mới" : ticket.status === "in_progress" ? "Đang xử lý" : "Đã xử lý"}</p></article>)}</div></section>;
}
