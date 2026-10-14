import { serverGetRenter } from "@/lib/api/renter.server";
import type { RenterTicket } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";

export default async function RenterTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const ticket = await serverGetRenter<RenterTicket>(`/api/renter/tickets/${encodeURIComponent(ticketId)}`);
  return <section className="space-y-5"><Link href="/portal/tickets" className="text-sm font-semibold text-primary underline">← Báo sự cố</Link><div><h1 className="font-heading text-2xl font-bold text-text">Chi tiết yêu cầu</h1><p className="mt-1 text-sm text-text-muted">{ticket.status === "open" ? "Mới" : ticket.status === "in_progress" ? "Đang xử lý" : "Đã xử lý"}</p></div><article className="space-y-4 rounded-card border border-border p-5"><p className="text-base leading-7 text-text-body">{ticket.description}</p>{ticket.photoUrls?.length ? <div className="grid grid-cols-2 gap-3">{ticket.photoUrls.map((url) => <Image key={url} src={url} alt="Ảnh sự cố" width={640} height={640} unoptimized className="aspect-square w-full rounded-input object-cover" />)}</div> : null}</article></section>;
}
