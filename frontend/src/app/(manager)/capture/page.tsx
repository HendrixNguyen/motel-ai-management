import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import { motelHref } from "@/lib/motel-navigation";
import PageHeader from "@/components/ui/page-header";

export default async function CapturePage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const [motels, query] = await Promise.all([listMotels(), searchParams]);
  const motelId = resolveMotelId(motels, query);
  if (!motelId) {
    if (motels.length === 0) return <section className="space-y-4"><PageHeader title="Nhập chỉ số" description="Chụp và nhập số điện nước trên điện thoại." /><p className="rounded-card border border-border bg-surface p-6 text-text-muted">Chưa có nhà trọ.</p></section>;
    return (
      <section className="space-y-6">
        <PageHeader title="Nhập chỉ số" description="Chọn một nhà trọ để nhập chỉ số điện nước." />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {motels.map((motel) => (
            <div key={motel.id} className="rounded-card border border-border bg-surface flex flex-col p-4 sm:p-6">
              <h2 className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">{motel.name}</h2>
              <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">{motel.address || "Chưa có địa chỉ"}</p>
              <div className="mt-auto pt-4">
                <Link href={motelHref("/capture", "", motel.id)} className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-primary">
                  Nhập chỉ số
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  const periods = await listBillingPeriods(motelId);
  const draft = periods.find((period) => period.status === "draft");
  return <section className="space-y-6"><PageHeader title="Nhập chỉ số" description="Lưu ngoại tuyến, đồng bộ khi có mạng." />{draft ? <Link href={`/capture/${draft.id}?motel=${encodeURIComponent(motelId)}`} className="flex min-h-14 items-center justify-center rounded-input bg-primary px-4 font-semibold text-surface">Mở kỳ {String(draft.month).padStart(2, "0")}/{draft.year}</Link> : <p className="rounded-card border border-border bg-surface p-6 text-text-muted">Không có kỳ nháp.</p>}</section>;
}
