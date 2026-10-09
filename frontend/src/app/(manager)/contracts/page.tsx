import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listContracts } from "@/lib/api/contracts";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import { formatVnd } from "@/lib/format/vnd";
import type { ContractStatus } from "@/lib/api/types";

const labels: Record<ContractStatus, string> = { draft: "Bản nháp", active: "Đang hiệu lực", expired: "Đã hết hạn", terminated: "Đã chấm dứt" };
const tones: Record<ContractStatus, BadgeTone> = { draft: "warning", active: "success", expired: "neutral", terminated: "danger" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const motelId = resolveMotelId(motels, await searchParams);
  if (!motelId) return <section className="space-y-6"><PageHeader title="Hợp đồng" description="Theo dõi thời hạn, tiền thuê và trạng thái ký." /><div className="rounded-card border border-border bg-surface p-6 text-text-muted">Tạo nhà trọ trước khi lập hợp đồng.</div></section>;
  const contracts = await listContracts(motelId);
  return <section className="space-y-6"><PageHeader title="Hợp đồng" description="Theo dõi thời hạn, tiền thuê và trạng thái ký." actions={<Link href={`/renters?motel=${encodeURIComponent(motelId)}`} className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong">Chọn khách thuê</Link>} />
    {contracts.length === 0 ? <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center"><p className="font-heading text-lg font-semibold text-text">Chưa có hợp đồng</p><p className="mt-2 text-text-muted">Tạo hợp đồng từ hồ sơ khách thuê để lưu điều khoản và thời hạn.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{contracts.map((contract) => <article key={contract.id} className="rounded-card border border-border bg-surface p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-text-muted">Phòng {contract.roomId.slice(0, 8)}</p><h2 className="mt-1 font-heading text-lg font-semibold text-text">Khách thuê {contract.renterId.slice(0, 8)}</h2></div><Badge label={labels[contract.status]} tone={tones[contract.status]} /></div><dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-text-muted">Thời hạn</dt><dd className="text-right font-medium text-text">{contract.startDate} – {contract.endDate}</dd></div><div className="flex justify-between gap-4"><dt className="text-text-muted">Tiền thuê</dt><dd className="font-semibold tabular-nums text-text">{formatVnd(contract.monthlyRent)}</dd></div><div className="flex justify-between gap-4"><dt className="text-text-muted">Ký OTP</dt><dd className="text-right text-text">{contract.otpSignedAt ? "Đã ký" : "Chưa ký"}</dd></div></dl></article>)}</div>}
  </section>;
}
