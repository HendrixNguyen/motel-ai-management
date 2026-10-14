import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import CaptureReadingClient from "@/components/manager/capture-reading-client";

export default async function CaptureReadingPage({ params, searchParams }: { params: Promise<{ periodId: string; readingId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId);
  const room = period.rooms.find((item) => item.readings.some((reading) => reading.id === route.readingId)); const reading = room?.readings.find((item) => item.id === route.readingId); if (!room || !reading) notFound();
  const roomIndex = period.rooms.findIndex((item) => item.id === room.id); const nextRoom = period.rooms.slice(roomIndex + 1).find((item) => item.readings.some((item) => item.currentReading === null)); const nextUrl = nextRoom ? `/capture/${period.id}/room/${nextRoom.readings[0]?.id ?? ""}?motel=${encodeURIComponent(motelId)}&room=${encodeURIComponent(nextRoom.id)}` : undefined;
  return <CaptureReadingClient motelId={motelId} period={period} reading={reading} roomName={room.name} roomReadings={room.readings} nextUrl={nextUrl} />;
}
