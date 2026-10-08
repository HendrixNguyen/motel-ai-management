import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import CaptureReadingClient from "@/components/manager/capture-reading-client";

export default async function CaptureReadingPage({ params, searchParams }: { params: Promise<{ periodId: string; readingId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId);
  const reading = period.rooms.flatMap((room) => room.readings).find((item) => item.id === route.readingId); if (!reading) notFound();
  return <CaptureReadingClient motelId={motelId} period={period} reading={reading} />;
}
