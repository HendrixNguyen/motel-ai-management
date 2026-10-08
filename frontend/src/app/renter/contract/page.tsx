import { getRenterContract } from "@/lib/api/renter";
import { formatVnd } from "@/lib/format/vnd";
import ContractActions from "@/components/renter/contract-actions";

export default async function RenterContractPage() {
  const contract = await getRenterContract();
  return <section className="space-y-6"><div><h1 className="font-heading text-2xl font-bold text-text">Hợp đồng thuê</h1><p className="mt-2 text-base text-text-muted">Xem điều khoản và ký bằng mã OTP.</p></div><article className="space-y-4 rounded-card border border-border p-5"><dl className="space-y-2"><div className="flex justify-between gap-4"><dt>Trạng thái</dt><dd className="font-semibold">{contract.status === "active" ? "Đang hiệu lực" : contract.status === "draft" ? "Chờ ký" : contract.status}</dd></div><div className="flex justify-between gap-4"><dt>Tiền thuê</dt><dd className="tabular-nums">{formatVnd(contract.monthlyRent)}</dd></div><div className="flex justify-between gap-4"><dt>Thời hạn</dt><dd>{contract.startDate} – {contract.endDate}</dd></div></dl><div className="space-y-3 border-t border-border pt-4"><h2 className="font-heading text-lg font-semibold text-text">Điều khoản</h2>{contract.clauses.map((clause, index) => <section key={`${clause.title}-${index}`}><h3 className="font-semibold text-text">{clause.title}</h3><p className="mt-1 whitespace-pre-wrap text-base leading-7">{clause.content}</p></section>)}</div><ContractActions contract={contract} /></article></section>;
}
