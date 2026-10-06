"use client";

import Link from "next/link";
import DataTable, { type DataColumn } from "@/components/ui/data-table";
import CopyButton from "@/components/ui/copy-button";
import Badge from "@/components/ui/badge";
import type { RenterResponse, RoomResponse } from "@/lib/api/types";
import RenterEditor from "./renter-editor";
import { formatPhone } from "@/lib/format/phone";
import { oaFollowerLabel, renterStatusLabel } from "@/lib/format/status";

export default function RenterTable({ renters, rooms, roomNames, motelId, roomId }: { renters: RenterResponse[]; rooms: RoomResponse[]; roomNames: Record<string, string>; motelId: string; roomId?: string }) {
  const query = new URLSearchParams({ motel: motelId });
  if (roomId) query.set("roomId", roomId);
  const columns: DataColumn<RenterResponse>[] = [
    { key: "name", label: "Họ tên", sortValue: (renter) => renter.name, render: (renter) => <span className="font-semibold">{renter.name}</span> },
    { key: "phone", label: "SĐT", render: (renter) => <div className="space-y-2"><a href={`tel:+${renter.phone}`} className="inline-flex min-h-11 items-center rounded-input text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{formatPhone(renter.phone)}</a><CopyButton value={`+${renter.phone}`} label={`Sao chép SĐT ${renter.name}`} /></div> },
    { key: "idNumber", label: "Số CCCD", render: (renter) => renter.idNumber ?? "Chưa cập nhật" },
    { key: "room", label: "Phòng", render: (renter) => renter.roomId ? roomNames[renter.roomId] ?? "Chưa cập nhật" : "Chưa xếp phòng" },
    { key: "status", label: "Trạng thái", render: (renter) => <Badge tone={renter.status === "active" ? "success" : "neutral"} label={renterStatusLabel(renter.status)} /> },
    { key: "oa", label: "Trạng thái Zalo OA", render: (renter) => <Badge tone={renter.isOaFollower ? "success" : "warning"} label={oaFollowerLabel(renter.isOaFollower)} /> },
    // List DTO carries createdAt only; recording a renter is not the start of a tenancy.
    { key: "start", label: "Ngày bắt đầu", render: () => "Chưa cập nhật" },
    { key: "actions", label: "Thao tác", render: (renter) => <div className="flex min-w-0 flex-wrap gap-2"><Link href={`/renters/${encodeURIComponent(renter.id)}?${query}`} aria-label={`Xem ${renter.name}`} className="inline-flex min-h-11 items-center rounded-input px-2 font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xem chi tiết</Link><RenterEditor motelId={motelId} rooms={rooms} renter={renter} /></div> },
  ];
  return <DataTable rows={renters} columns={columns} getRowId={(renter) => renter.id} searchText={(renter) => `${renter.name} ${renter.phone} ${renter.idNumber ?? ""} ${renter.roomId ? roomNames[renter.roomId] ?? "" : ""}`} caption="Danh sách khách thuê" />;
}
