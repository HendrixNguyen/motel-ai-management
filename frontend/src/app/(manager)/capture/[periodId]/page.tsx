import { notFound } from "next/navigation";
import { getBillingPeriod } from "@/lib/api/billing";
import { listMotels } from "@/lib/api/motels";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import CapturePeriodOverview from "@/components/manager/capture-period-overview";

export default async function CapturePeriodPage({ params, searchParams }: { params: Promise<{ periodId: string }>; searchParams: Promise<MotelSearchParams> }) {
  const [route, query, motels] = await Promise.all([params, searchParams, listMotels()]);
  const motelId = resolveMotelId(motels, query); if (!motelId) notFound();
  const period = await getBillingPeriod(motelId, route.periodId);
  return <section className="space-y-6"><PageHeader title={`Nhập chỉ số ${String(period.month).padStart(2, "0")}/${period.year}`} description="Tiến độ từng phòng và trạng thái đồng bộ." /><CapturePeriodOverview period={period} motelId={motelId} /></section>;
}
