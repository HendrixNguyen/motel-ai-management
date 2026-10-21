import Link from "next/link";
import { listMotels } from "@/lib/api/motels";
import { listContracts, listContractTemplates } from "@/lib/api/contracts";
import ContractManagementClient from "@/components/manager/contract-management-client";
import { listRenters } from "@/lib/api/renters";
import { listRooms } from "@/lib/api/rooms";
import { resolveMotelId, type MotelSearchParams } from "@/lib/motel-selection";
import PageHeader from "@/components/ui/page-header";
import Card from "@/components/ui/card";
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<MotelSearchParams>;
}) {
  const motels = await listMotels();
  const motelId = resolveMotelId(motels, await searchParams);
  if (!motelId)
    return (
      <section className="min-w-0 space-y-6">
        <PageHeader title="Hợp đồng" description="Theo dõi thời hạn, tiền thuê và trạng thái ký." />
        <Card className="text-text-muted">Tạo nhà trọ trước khi lập hợp đồng.</Card>
      </section>
    );
  const [contracts, renters, rooms, templates] = await Promise.all([
    listContracts(motelId),
    listRenters(motelId),
    listRooms(motelId),
    listContractTemplates(motelId),
  ]);
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Hợp đồng"
        description="Theo dõi thời hạn, tiền thuê và trạng thái ký."
        actions={
          <div className="flex min-w-0 flex-wrap gap-2">
            <Link
              href={`/renters?motel=${encodeURIComponent(motelId)}&create=1`}
              className="inline-flex min-h-11 items-center rounded-input bg-primary px-4 font-semibold text-surface hover:bg-primary-strong"
            >
              Chọn khách thuê
            </Link>
            <Link
              href={`/renters?motel=${encodeURIComponent(motelId)}`}
              className="inline-flex min-h-11 items-center rounded-input border border-border-strong bg-surface px-4 font-semibold text-text hover:bg-canvas"
            >
              Quản lý khách thuê
            </Link>
          </div>
        }
      />
      <ContractManagementClient
        motelId={motelId}
        renters={renters}
        rooms={rooms}
        contracts={contracts}
        templates={templates}
      />
    </section>
  );
}
