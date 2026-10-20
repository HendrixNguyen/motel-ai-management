import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import CapturePeriodList from "@/components/manager/capture-period-list";

export default async function CapturePage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const [motels, query] = await Promise.all([listMotels(), searchParams]);
  const motelId = resolveMotelId(motels, query);
  if (!motelId) return <section className="space-y-4"><PageHeader title="Nhập chỉ số" description="Chụp và nhập số điện nước trên điện thoại." /><p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có nhà trọ.</p></section>;
  const periods = await listBillingPeriods(motelId);
  return <section className="space-y-6"><PageHeader title="Nhập chỉ số" description="Chọn kỳ nháp để tiếp tục ghi số điện, nước. Dữ liệu lưu trên thiết bị khi mất mạng." /><CapturePeriodList periods={periods} motelId={motelId} /></section>;
}
