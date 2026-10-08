import { apiSend, assertRelativePath, decodeResponse } from "./client";
import type { ReadingConflictDetails, UpdateReadingsInput, UploadResponse } from "./types";
import { ApiError } from "./client";

const readingPath = (motelId: string, periodId: string, readingId: string) => `/api/manager/motels/${encodeURIComponent(motelId)}/billing/periods/${encodeURIComponent(periodId)}/readings/${encodeURIComponent(readingId)}/photo`;

export function uploadMeterPhoto(motelId: string, periodId: string, readingId: string, file: File): Promise<UploadResponse> {
  const path = readingPath(motelId, periodId, readingId); assertRelativePath(path);
  return fetch(path, { method: "POST", credentials: "same-origin", headers: { accept: "application/json" }, body: (() => { const body = new FormData(); body.append("file", file); return body; })() }).then(decodeResponse<UploadResponse>);
}

export function saveCaptureReadings(motelId: string, periodId: string, readings: UpdateReadingsInput) { return apiSend(`/api/manager/motels/${encodeURIComponent(motelId)}/billing/periods/${encodeURIComponent(periodId)}/readings`, "PUT", readings); }

export function isReadingConflict(error: unknown): error is ApiError & { details?: ReadingConflictDetails } { return error instanceof ApiError && error.code === "READING_CONFLICT"; }
