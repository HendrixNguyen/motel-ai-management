import { listMotels } from "@/lib/api/motels";
import Link from "next/link";
import Card from "@/components/ui/card";
import { listBillingPeriods } from "@/lib/api/billing";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import { motelHref } from "@/lib/motel-navigation";
import PageHeader from "@/components/ui/page-header";
import CapturePeriodList from "@/components/manager/capture-period-list";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  const [motels, query] = await Promise.all([listMotels(), searchParams]);
  if (typeof query.motel === "string" && query.motel !== "")
    resolveMotelId(motels, { motel: query.motel });
  const motelId = resolveMotelId(motels, query);
  if (!motelId) {
    if (!motels.length)
      return (
        <section className="min-w-0 space-y-6">
          <PageHeader title="Nhập chỉ số" description="Chụp và nhập số điện nước trên điện thoại." />
          <p className="rounded-card border border-border bg-surface p-6 text-text-muted">
            Chưa có nhà trọ.
          </p>
        </section>
      );
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader title="Nhập chỉ số" description="Chọn một nhà trọ để nhập số điện nước." />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {motels.map((motel) => (
            <Card key={motel.id} className="flex min-w-0 flex-col p-4 sm:p-6">
              <h2 className="font-heading text-lg font-semibold text-text [overflow-wrap:anywhere]">
                {motel.name}
              </h2>
              <p className="mt-1 text-sm text-text-muted [overflow-wrap:anywhere]">
                {motel.address || "Chưa có địa chỉ"}
              </p>
              <div className="mt-auto pt-4">
                <Link
                  href={motelHref("/capture", "", motel.id)}
                  className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Nhập chỉ số
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }
  const periods = await listBillingPeriods(motelId);
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Nhập chỉ số"
        description="Chọn kỳ nháp để tiếp tục ghi số điện, nước. Dữ liệu lưu trên thiết bị khi mất mạng."
      />
      <CapturePeriodList periods={periods} motelId={motelId} />
    </section>
  );
}
