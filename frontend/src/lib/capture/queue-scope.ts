export type CaptureQueueScope = { managerId: string; motelId: string; periodId: string };
export function createCaptureQueueScope(
  managerId: string,
  motelId: string,
  periodId: string,
): CaptureQueueScope {
  if (!managerId.trim() || !motelId.trim() || !periodId.trim())
    throw new Error("CAPTURE_IDENTITY_REQUIRED");
  return { managerId, motelId, periodId };
}
