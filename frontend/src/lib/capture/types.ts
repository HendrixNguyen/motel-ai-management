import type { MeterType } from "@/lib/api/types";

export type CaptureQueueStatus = "pending" | "failed" | "conflict" | "sent" | "locked";
export type CaptureReading = { roomId: string; type: MeterType; currentReading: string; expectedUpdatedAt: string };
export type CaptureQueueInput = { managerId: string; motelId: string; periodId: string; periodStatus: "draft" | "sent" | "closed"; readings: CaptureReading[] };
export type CaptureQueueItem = CaptureQueueInput & { id: string; status: CaptureQueueStatus; attempts: number; createdAt: string; conflict?: { server: string | null; message: string } };
export type CapturePhotoItem = { id: string; managerId: string; motelId: string; periodId: string; readingId: string; periodStatus: "draft" | "sent" | "closed"; file: Blob; status: "pending" | "failed" | "sent" | "locked"; attempts: number; createdAt: string };
