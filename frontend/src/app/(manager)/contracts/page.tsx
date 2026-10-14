import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listContracts, listContractTemplates } from "@/lib/api/contracts";
import ContractManagementClient from "@/components/manager/contract-management-client";
import { listRenters } from "@/lib/api/renters";
import { listRooms } from "@/lib/api/rooms";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
export default async function ContractsPage({ searchParams }: { searchParams: Promise<MotelSearchParams> }) {
  const motels = await listMotels();
  const motelId = resolveMotelId(motels, await searchParams);
  if (!motelId) return <section className="space-y-6"><PageHeader title="Hợp đồng" description="Theo dõi thời hạn, tiền thuê và trạng thái ký." /><div className="rounded-card border border-border bg-surface p-6 text-text-muted">Tạo nhà trọ trước khi lập hợp đồng.</div></section>;
  const [contracts, renters, rooms, templates] = await Promise.all([listContracts(motelId), listRenters(motelId), listRooms(motelId), listContractTemplates(motelId)]);
  return <section className="space-y-6"><PageHeader title="Hợp đồng" description="Theo dõi thời hạn, tiền thuê và trạng thái ký." actions={<Link href={`/renters?motel=${encodeURIComponent(motelId)}`} className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong">Chọn khách thuê</Link>} />
    <ContractManagementClient motelId={motelId} renters={renters} rooms={rooms} contracts={contracts} templates={templates} />
  </section>;
}
