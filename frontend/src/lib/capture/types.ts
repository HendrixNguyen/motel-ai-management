import type { MeterType } from "@/lib/api/types";

export type CaptureQueueStatus = "pending" | "failed" | "conflict" | "sent" | "locked";
export type CaptureReading = { roomId: string; type: MeterType; currentReading: string; expectedUpdatedAt: string };
export type CaptureQueueInput = { managerId: string; motelId: string; periodId: string; periodStatus: "draft" | "sent" | "closed"; readings: CaptureReading[]; photoRefs?: string[] };
export type CaptureQueueItem = CaptureQueueInput & { id: string; status: CaptureQueueStatus; attempts: number; createdAt: string };
