import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { getMe } from "@/lib/api/auth";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import CaptureReadingClient from "@/components/manager/capture-reading-client";

export default async function CaptureReadingPage({ params, searchParams }: { params: Promise<{ periodId: string; readingId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels, manager] = await Promise.all([params, searchParams, listMotels(), getMe()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId);
  const room = period.rooms.find((item) => item.readings.some((reading) => reading.id === route.readingId)); const reading = room?.readings.find((item) => item.id === route.readingId); if (!room || !reading) notFound(); const orderedReadings = [...room.readings].sort((a, b) => (a.type === "electric" ? 0 : 1) - (b.type === "electric" ? 0 : 1));
  return <CaptureReadingClient managerId={manager.id} motelId={motelId} period={period} reading={reading} roomName={room.name} roomReadings={orderedReadings} />;
}
