"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRenterTicket } from "@/lib/api/renter";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import type { RenterTicketCategory } from "@/lib/api/types";

export default function TicketForm() {
  const router = useRouter(); const [category, setCategory] = useState<RenterTicketCategory>("facilities"); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (description.trim().length < 10) { setError("Mô tả sự cố phải có ít nhất 10 ký tự"); return; } setPending(true); setError(""); try { await createRenterTicket({ category, description: description.trim() }); router.refresh(); setDescription(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Đã xảy ra lỗi hệ thống"); } finally { setPending(false); } }
  return <form onSubmit={submit} className="space-y-4 rounded-card border border-border p-5"><Field id="category" label="Loại sự cố">{(props) => <select {...props} value={category} onChange={(event) => setCategory(event.target.value as RenterTicketCategory)}><option value="electricity">Điện</option><option value="water">Nước</option><option value="facilities">Cơ sở vật chất</option><option value="other">Khác</option></select>}</Field><Field id="description" label="Mô tả" hint="Tối thiểu 10 ký tự." error={error}>{(props) => <textarea {...props} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />}</Field><Button type="submit" pending={pending} pendingLabel="Đang gửi…">Gửi yêu cầu</Button></form>;
}
