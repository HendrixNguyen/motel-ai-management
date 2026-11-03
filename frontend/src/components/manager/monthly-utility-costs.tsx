"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMonthlyUtilityCosts } from "@/lib/api/billing.client";
import type { MonthlyUtilityReport } from "@/lib/api/types";
import { parseVndDigits, formatVnd } from "@/lib/format/vnd";
import { Dialog } from "@/components/ui/modal";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Field from "@/components/ui/field";

type Props = { motelId: string; year: number; month: number; report: MonthlyUtilityReport };

const money = (value: string | null) => value === null ? "Chưa nhập" : formatVnd(value);

export default function MonthlyUtilityCosts({ motelId, year, month, report }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [electricityAmount, setElectricityAmount] = useState(report.costs.electricityAmount ?? "");
  const [waterAmount, setWaterAmount] = useState(report.costs.waterAmount ?? "");
  const [electricityNotes, setElectricityNotes] = useState(report.costs.electricityNotes ?? "");
  const [waterNotes, setWaterNotes] = useState(report.costs.waterNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const electricity = electricityAmount.trim() === "" ? null : parseVndDigits(electricityAmount);
    const water = waterAmount.trim() === "" ? null : parseVndDigits(waterAmount);
    if ((electricityAmount.trim() && electricity === null) || (waterAmount.trim() && water === null)) {
      setError("Nhập số tiền nguyên không âm bằng VND.");
      return;
    }
    setBusy(true);
    try {
      await saveMonthlyUtilityCosts(motelId, year, month, {
        electricityAmount: electricity,
        waterAmount: water,
        electricityNotes: electricityNotes.trim() || null,
        waterNotes: waterNotes.trim() || null,
      });
      setOpen(false);
      setMessage("Đã lưu chi phí điện nước.");
      router.refresh();
    } catch {
      setError("Không lưu được chi phí. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="utility-report-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="utility-report-title" className="font-heading text-xl font-bold text-text">Thu/chi điện nước</h2>
          <p className="mt-1 text-sm text-text-muted">Tháng {String(month).padStart(2, "0")}/{year}</p>
        </div>
        <Button onClick={() => { setError(""); setOpen(true); }}>Nhập chi phí</Button>
      </div>
      {report.periodStatus === null || report.periodStatus === "draft" ? (
        <p className="rounded-card border border-border bg-canvas p-4 text-sm text-text-muted">Chưa có kỳ hóa đơn đã chốt; số phải thu và đã thu đang bằng 0.</p>
      ) : null}
      {report.costs.electricityAmount === null || report.costs.waterAmount === null ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 p-4 text-sm text-text-muted">Chi phí chưa nhập được hiển thị là “Chưa nhập”, không phải 0 đồng.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold text-text">Điện</h3>
          <Metric label="Phải thu từ các phòng" value={formatVnd(report.electricity.billed)} />
          <Metric label="Đã thu từ các phòng" value={formatVnd(report.electricity.collected)} />
          <Metric label="Chủ trọ đã chi" value={money(report.electricity.cost)} />
          <Metric label="Chênh lệch phải thu - chi" value={money(report.electricity.billedDifference)} />
          <Metric label="Chênh lệch đã thu - chi" value={money(report.electricity.collectedDifference)} />
        </Card>
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold text-text">Nước</h3>
          <Metric label="Phải thu từ các phòng" value={formatVnd(report.water.billed)} />
          <Metric label="Đã thu từ các phòng" value={formatVnd(report.water.collected)} />
          <Metric label="Chủ trọ đã chi" value={money(report.water.cost)} />
          <Metric label="Chênh lệch phải thu - chi" value={money(report.water.billedDifference)} />
          <Metric label="Chênh lệch đã thu - chi" value={money(report.water.collectedDifference)} />
        </Card>
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold text-text">Tổng điện nước</h3>
          <Metric label="Phải thu từ các phòng" value={formatVnd(report.utilities.billed)} />
          <Metric label="Đã thu từ các phòng" value={formatVnd(report.utilities.collected)} />
          <Metric label="Chủ trọ đã chi" value={money(report.utilities.cost)} />
          <Metric label="Chênh lệch phải thu - chi" value={money(report.utilities.billedDifference)} />
          <Metric label="Chênh lệch đã thu - chi" value={money(report.utilities.collectedDifference)} />
        </Card>
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold text-text">Tổng tiền phòng</h3>
          <Metric label="Phải thu từ các phòng" value={formatVnd(report.totals.billed)} />
          <Metric label="Đã thu từ các phòng" value={formatVnd(report.totals.collected)} />
          <Metric label="Chưa thu" value={formatVnd(report.totals.outstanding)} />
          <Metric label="Phải thu trừ chi phí điện nước" value={money(report.totals.billedLessUtilityCosts)} />
          <Metric label="Đã thu trừ chi phí điện nước" value={money(report.totals.collectedLessUtilityCosts)} />
        </Card>
      </div>
      <p className="text-sm text-text-muted">Chênh lệch chưa trừ các chi phí khác; không phải lợi nhuận ròng hoặc dòng tiền thực tế.</p>
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      <Dialog open={open} onClose={() => setOpen(false)} title="Nhập chi phí điện nước" description={`Tháng ${String(month).padStart(2, "0")}/${year}. Số tiền chủ trọ đã trả cho cả nhà trọ trong kỳ đã chọn, không phải chỉ số công tơ.`}>
        <form className="space-y-4" onSubmit={save}>
          <Field id="utility-electricity" label="Tiền điện tổng đã trả" hint="VND" >
            {(props) => <input {...props} inputMode="numeric" value={electricityAmount} onChange={(event) => setElectricityAmount(event.target.value)} />}
          </Field>
          <Field id="utility-electricity-notes" label="Ghi chú tiền điện">
            {(props) => <textarea {...props} rows={2} value={electricityNotes} onChange={(event) => setElectricityNotes(event.target.value)} />}
          </Field>
          <Field id="utility-water" label="Tiền nước tổng đã trả" hint="VND">
            {(props) => <input {...props} inputMode="numeric" value={waterAmount} onChange={(event) => setWaterAmount(event.target.value)} />}
          </Field>
          <Field id="utility-water-notes" label="Ghi chú tiền nước">
            {(props) => <textarea {...props} rows={2} value={waterNotes} onChange={(event) => setWaterNotes(event.target.value)} />}
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu chi phí"}</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-text-muted">{label}</span><strong className="text-right tabular-nums text-text whitespace-nowrap">{value}</strong></div>;
}
