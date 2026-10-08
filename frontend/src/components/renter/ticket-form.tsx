"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRenterTicket } from "@/lib/api/renter";
import Button from "@/components/ui/button";
import Field from "@/components/ui/field";
import type { RenterTicketCategory } from "@/lib/api/types";

export default function TicketForm() {
  const router = useRouter(); const [category, setCategory] = useState<RenterTicketCategory>("facilities"); const [description, setDescription] = useState(""); const [photos, setPhotos] = useState<File[]>([]); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (description.trim().length < 10) { setError("Mô tả sự cố phải có ít nhất 10 ký tự"); return; } setPending(true); setError(""); try { await createRenterTicket({ category, description: description.trim(), photos }); router.refresh(); setDescription(""); setPhotos([]); } catch (cause) { setError(cause instanceof Error ? cause.message : "Đã xảy ra lỗi hệ thống"); } finally { setPending(false); } }
  return <form onSubmit={submit} className="space-y-4 rounded-card border border-border p-5"><Field id="category" label="Loại sự cố">{(props) => <select {...props} value={category} onChange={(event) => setCategory(event.target.value as RenterTicketCategory)}><option value="electricity">Điện</option><option value="water">Nước</option><option value="facilities">Cơ sở vật chất</option><option value="other">Khác</option></select>}</Field><Field id="description" label="Mô tả" hint={`${description.length}/500 ký tự · Tối thiểu 10 ký tự.`} error={error}>{(props) => <textarea {...props} rows={5} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />}</Field><label className="block text-sm font-semibold text-text" htmlFor="photos">Ảnh (tối đa 5)<input id="photos" type="file" accept="image/jpeg,image/png" multiple className="mt-2 block min-h-11 w-full text-base" onChange={(event) => { previewUrls.forEach((url) => URL.revokeObjectURL(url)); const next = Array.from(event.target.files ?? []).slice(0, 5); setPhotos(next); setPreviewUrls(next.map((photo) => URL.createObjectURL(photo))); }} /></label>{photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((photo, index) => <figure key={`${photo.name}-${index}`}><img src={previewUrls[index]} alt={`Ảnh sự cố ${index + 1}`} className="aspect-square w-full rounded-input object-cover" /><button type="button" className="mt-1 text-xs font-semibold text-danger underline" onClick={() => { URL.revokeObjectURL(previewUrls[index] ?? ""); setPhotos((current) => current.filter((_, item) => item !== index)); setPreviewUrls((current) => current.filter((_, item) => item !== index)); }}>Xóa ảnh</button></figure>)}</div>}<Button type="submit" pending={pending} pendingLabel="Đang gửi…">Gửi yêu cầu</Button></form>;
}
