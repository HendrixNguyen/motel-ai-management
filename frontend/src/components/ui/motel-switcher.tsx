import type { MotelResponse } from "@/lib/api/types";

export default function MotelSwitcher({ motels, selectedId, onChange, disabled = false }: { motels: MotelResponse[]; selectedId?: string; onChange: (id: string) => void; disabled?: boolean }) {
  return <label className="block min-w-0"><span className="sr-only">Nhà trọ</span><select id="motel-selector" aria-label="Nhà trọ" value={selectedId ?? ""} disabled={motels.length === 0 || disabled} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-input border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><option value="">{motels.length ? "Chọn nhà trọ" : "Chưa có nhà trọ"}</option>{motels.map((motel) => <option key={motel.id} value={motel.id}>{motel.name}</option>)}</select></label>;
}
